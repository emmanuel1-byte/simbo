package conversation

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"simbo-api-service/internal/database/store"

	"github.com/jackc/pgx/v5/pgtype"
)

const (
	resultCacheTTL = 5 * time.Minute
	schemaCacheTTL = 10 * time.Minute
	historyLimit   = 10
)

// PipelineRunner is the interface the handler uses — makes it fully mockable.
type PipelineRunner interface {
	Run(ctx context.Context, input PipelineInput, out chan<- StreamEvent)
}

// PipelineInput carries everything the pipeline needs for one query.
type PipelineInput struct {
	ConversationID pgtype.UUID
	UserID         pgtype.UUID
	Message        string
	InputMode      string // "text" | "voice" — defaults to InputModeText when empty
}

// Decryptor decrypts a stored ciphertext (satisfied by connection.AESEncryptor).
type Decryptor interface {
	Decrypt(ciphertext string) (string, error)
}

// runDeps holds all loaded and decrypted dependencies for a single pipeline run.
type runDeps struct {
	conv       store.Conversation
	dbConn     store.Connection
	dbPassword string
	apiKey     store.ApiKey
	llm        LLM
	schema     string
	history    []HistoryMsg
	mode       string
}

// Pipeline orchestrates parse → SQL → validate → execute → summarize.
type Pipeline struct {
	q           Querier
	dec         Decryptor
	exec        Executor
	introspec   Introspector
	resultCache *Cache[*QueryResult]
	schemaCache *Cache[string]
}

// NewPipeline creates a production Pipeline.
func NewPipeline(q Querier, dec Decryptor, exec Executor, intro Introspector) *Pipeline {
	return &Pipeline{
		q:           q,
		dec:         dec,
		exec:        exec,
		introspec:   intro,
		resultCache: NewCache[*QueryResult](),
		schemaCache: NewCache[string](),
	}
}

// Run executes the pipeline and sends SSE events to out. Errors are forwarded
// as error events; the channel is always closed when Run returns.
func (p *Pipeline) Run(ctx context.Context, input PipelineInput, out chan<- StreamEvent) {
	start := time.Now()
	emit := func(kind string, data any) { out <- StreamEvent{Kind: kind, Data: data} }
	fail := func(phase, msg string) { emit(KindError, ErrorPayload{Phase: phase, Message: msg}) }

	deps, err := p.loadDeps(ctx, input)
	if err != nil {
		fail(PhaseParseIntent, err.Error())
		return
	}

	// Save user message immediately — it appears in the chat before the response
	if err = p.saveUserMessage(ctx, input, deps.mode); err != nil {
		fail(PhaseParseIntent, "failed to save message")
		return
	}

	sqlResult, err := p.generateSQL(ctx, deps, input.Message, start, emit)
	if err != nil {
		fail(PhaseParseIntent, err.Error())
		return
	}

	if err = p.validateSQL(sqlResult.SQL, start, emit); err != nil {
		fail(PhaseValidating, "Guardrail blocked: "+err.Error())
		return
	}

	result, execDuration, wasCached, err := p.executeQuery(ctx, deps, sqlResult.SQL, start, emit)
	if err != nil {
		fail(PhaseExecuting, "Query failed: "+err.Error())
		return
	}

	summary, err := p.streamSummary(ctx, deps.llm, input.Message, result, emit)
	if err != nil && ctx.Err() == nil {
		fail("summarize", "Summary generation failed: "+err.Error())
		return
	}

	msgID := p.saveAssistant(ctx, input.ConversationID, assistantResult{
		sqlResult: sqlResult, result: result, summary: summary,
		execDuration: execDuration, wasCached: wasCached,
	})

	_ = p.q.TouchConversation(ctx, input.ConversationID)
	_ = p.q.TouchAPIKey(ctx, deps.apiKey.ID)

	emit(KindDone, DonePayload{MessageID: msgID, TotalMs: ms(start)})
}

// loadDeps loads the conversation, connection, API key, decrypts credentials,
// builds the LLM client, and populates schema + history.
func (p *Pipeline) loadDeps(ctx context.Context, input PipelineInput) (*runDeps, error) {
	conv, err := p.q.GetConversation(ctx, store.GetConversationParams{
		ID: input.ConversationID, UserID: input.UserID,
	})
	if err != nil {
		return nil, fmt.Errorf("conversation not found")
	}

	dbConn, err := p.q.GetConnectionByID(ctx, store.GetConnectionByIDParams{
		ID: conv.ConnectionID, UserID: input.UserID,
	})
	if err != nil {
		return nil, fmt.Errorf("database connection not found")
	}

	dbPassword, err := p.dec.Decrypt(dbConn.PasswordEncrypted)
	if err != nil {
		return nil, fmt.Errorf("credential decryption error")
	}

	var llmClient LLM
	var activeKey store.ApiKey

	// User's own API key takes priority. Fall back to the system Gemini key
	// when the user has none configured.
	if userKey, kErr := p.q.GetActiveAPIKey(ctx, input.UserID); kErr == nil {
		activeKey = userKey
		rawKey, dErr := p.dec.Decrypt(userKey.KeyEncrypted)
		if dErr != nil {
			return nil, fmt.Errorf("API key decryption error")
		}
		if llmClient, err = NewLLM(fmt.Sprint(userKey.Provider), userKey.Model, rawKey); err != nil {
			return nil, err
		}
	} else if sysKey := os.Getenv("GEMINI_API_KEY"); sysKey != "" {
		if llmClient, err = NewLLM("gemini", "gemini-2.0-flash-lite", sysKey); err != nil {
			return nil, err
		}
	} else {
		return nil, fmt.Errorf("no active API key — add one in Settings → API key")
	}

	schema, err := p.loadSchema(ctx, conv.ConnectionID, dbConn, dbPassword)
	if err != nil {
		return nil, fmt.Errorf("schema introspection failed: %w", err)
	}

	history, _ := p.buildHistory(ctx, input.ConversationID)

	mode := input.InputMode
	if mode == "" {
		mode = InputModeText
	}

	return &runDeps{
		conv: conv, dbConn: dbConn, dbPassword: dbPassword,
		apiKey: activeKey, llm: llmClient, schema: schema, history: history, mode: mode,
	}, nil
}

func (p *Pipeline) loadSchema(ctx context.Context, connID pgtype.UUID, dbConn store.Connection, password string) (string, error) {
	key := connID.String()
	if schema, ok := p.schemaCache.Get(key); ok {
		return schema, nil
	}
	schema, err := p.introspec.Introspect(ctx, dbConn, password)
	if err != nil {
		return "", err
	}
	p.schemaCache.Set(key, schema, schemaCacheTTL)
	return schema, nil
}

func (p *Pipeline) saveUserMessage(ctx context.Context, input PipelineInput, mode string) error {
	_, err := p.q.CreateMessage(ctx, store.CreateMessageParams{
		ConversationID: input.ConversationID,
		Role:           "user",
		Content:        input.Message,
		InputMode:      mode,
	})
	return err
}

func (p *Pipeline) generateSQL(ctx context.Context, deps *runDeps, question string, start time.Time, emit func(string, any)) (*SQLGenResult, error) {
	emit(KindStep, StepPayload{Phase: PhaseParseIntent, Ms: ms(start)})
	result, err := deps.llm.GenerateSQL(ctx, deps.schema, deps.history, question)
	if err != nil {
		return nil, fmt.Errorf("SQL generation failed: %w", err)
	}
	emit(KindStep, StepPayload{
		Phase:          PhaseSQLReady,
		Ms:             ms(start),
		Interpretation: &result.Interpretation,
		SQL:            result.SQL,
	})
	return result, nil
}

func (p *Pipeline) validateSQL(sql string, start time.Time, emit func(string, any)) error {
	emit(KindStep, StepPayload{Phase: PhaseValidating, Ms: ms(start)})
	if err := ValidateSQL(sql); err != nil {
		return err
	}
	emit(KindStep, StepPayload{Phase: PhaseValidated, Ms: ms(start)})
	return nil
}

func (p *Pipeline) executeQuery(ctx context.Context, deps *runDeps, sql string, start time.Time, emit func(string, any)) (*QueryResult, time.Duration, bool, error) {
	cacheKey := ResultCacheKey(deps.conv.ConnectionID.String(), sql)
	emit(KindStep, StepPayload{Phase: PhaseExecuting, Ms: ms(start)})

	if cached, ok := p.resultCache.Get(cacheKey); ok {
		emit(KindStep, StepPayload{Phase: PhaseExecuted, Ms: ms(start), Rows: len(cached.Rows), Cols: len(cached.Columns), Cached: true, Result: cached})
		return cached, 0, true, nil
	}

	result, dur, err := p.exec.Execute(ctx, deps.dbConn, deps.dbPassword, sql)
	if err != nil {
		return nil, 0, false, err
	}
	p.resultCache.Set(cacheKey, result, resultCacheTTL)
	emit(KindStep, StepPayload{Phase: PhaseExecuted, Ms: ms(start), Rows: len(result.Rows), Cols: len(result.Columns), Cached: false, Result: result})
	return result, dur, false, nil
}

func (p *Pipeline) streamSummary(ctx context.Context, llm LLM, question string, result *QueryResult, emit func(string, any)) (string, error) {
	// No rows means no data to summarise — skip the LLM entirely to prevent hallucination.
	if len(result.Rows) == 0 {
		const msg = "No matching data was found in the database for this query."
		emit(KindToken, msg)
		return msg, nil
	}

	resultJSON, _ := json.Marshal(result)
	tokenCh := make(chan string, 64)
	var summaryErr error
	var sb strings.Builder

	go func() {
		defer close(tokenCh)
		summaryErr = llm.StreamSummary(ctx, question, string(resultJSON), tokenCh)
	}()

	for token := range tokenCh {
		sb.WriteString(token)
		emit(KindToken, token)
	}
	return sb.String(), summaryErr
}

type assistantResult struct {
	sqlResult    *SQLGenResult
	result       *QueryResult
	summary      string
	execDuration time.Duration
	wasCached    bool
}

func (p *Pipeline) saveAssistant(ctx context.Context, convID pgtype.UUID, ar assistantResult) string {
	interpretBytes, _ := json.Marshal(ar.sqlResult.Interpretation)
	resultJSON, _ := json.Marshal(ar.result)
	execMs := int32(ar.execDuration.Milliseconds())

	msg, err := p.q.CreateMessage(ctx, store.CreateMessageParams{
		ConversationID:  convID,
		Role:            "assistant",
		Content:         ar.summary,
		InputMode:       InputModeText,
		Interpretation:  interpretBytes,
		SqlQuery:        pgtype.Text{String: ar.sqlResult.SQL, Valid: true},
		ExecutionTimeMs: pgtype.Int4{Int32: execMs, Valid: true},
		RowCount:        pgtype.Int4{Int32: int32(len(ar.result.Rows)), Valid: true},
		ColCount:        pgtype.Int4{Int32: int32(len(ar.result.Columns)), Valid: true},
		ResultData:      resultJSON,
		IsCached:        ar.wasCached,
	})
	if err != nil {
		return ""
	}
	return msg.ID.String()
}

func (p *Pipeline) buildHistory(ctx context.Context, convID pgtype.UUID) ([]HistoryMsg, error) {
	msgs, err := p.q.ListMessages(ctx, convID)
	if err != nil {
		return nil, err
	}
	if len(msgs) > historyLimit {
		msgs = msgs[len(msgs)-historyLimit:]
	}
	history := make([]HistoryMsg, 0, len(msgs))
	for _, m := range msgs {
		history = append(history, HistoryMsg{Role: m.Role, Content: m.Content})
	}
	return history, nil
}

func ms(since time.Time) int64 { return time.Since(since).Milliseconds() }
