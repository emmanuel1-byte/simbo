package conversation

import (
	"encoding/json"
	"fmt"
	"time"

	"simbo-api-service/internal/database/store"

	"github.com/jackc/pgx/v5/pgtype"
)

// --- SSE event kinds --------------------------------------------------------

const (
	KindStep  = "step"
	KindToken = "token"
	KindError = "error"
	KindDone  = "done"

	PhaseTranscribing = "transcribing"
	PhaseTranscribed  = "transcribed"
	PhaseParseIntent  = "parsing"
	PhaseSQLReady     = "sql_ready"
	PhaseValidating   = "validating"
	PhaseValidated    = "validated"
	PhaseExecuting    = "executing"
	PhaseExecuted     = "executed"

	InputModeText  = "text"
	InputModeVoice = "voice"
)

// StreamEvent is sent over the SSE channel to the client.
type StreamEvent struct {
	Kind string
	Data any
}

// StepPayload carries progress data for timeline steps.
type StepPayload struct {
	Phase          string          `json:"phase"`
	Ms             int64           `json:"ms"`
	Transcription  string          `json:"transcription,omitempty"` // voice only
	Interpretation *Interpretation `json:"interpretation,omitempty"`
	SQL            string          `json:"sql,omitempty"`
	Rows           int             `json:"rows,omitempty"`
	Cols           int             `json:"cols,omitempty"`
	Cached         bool            `json:"cached,omitempty"`
	Result         *QueryResult    `json:"result,omitempty"`
}

// DonePayload is the final event.
type DonePayload struct {
	MessageID string `json:"messageId"`
	TotalMs   int64  `json:"totalMs"`
}

// ErrorPayload describes a pipeline failure.
type ErrorPayload struct {
	Phase   string `json:"phase"`
	Message string `json:"message"`
}

// --- LLM types --------------------------------------------------------------

// Interpretation is the parsed intent from the LLM.
type Interpretation struct {
	Summary string `json:"summary"`
	Tags    []Tag  `json:"tags"`
}

// Tag is a semantic label extracted from the user's question.
type Tag struct {
	Type  string `json:"type"`  // table | filter | agg | range | group | join | sort | limit
	Value string `json:"value"`
}

// SQLGenResult is the structured output of the SQL generation step.
type SQLGenResult struct {
	Interpretation Interpretation `json:"interpretation"`
	SQL            string         `json:"sql"`
}

// QueryResult holds the execution output (serialisable, no credentials).
type QueryResult struct {
	Columns []string `json:"columns"`
	Rows    [][]any  `json:"rows"`
}

// HistoryMsg is a turn in the conversation passed as context to the LLM.
type HistoryMsg struct {
	Role    string
	Content string
}

// --- Message response type --------------------------------------------------

// MessageResponse is the rich, client-facing representation of a message.
// It unmarshals JSONB fields (interpretation, result_data) into proper types.
type MessageResponse struct {
	ID              string          `json:"id"`
	Role            string          `json:"role"`
	Content         string          `json:"content"`
	InputMode       string          `json:"inputMode"`
	CreatedAt       time.Time       `json:"createdAt"`
	// Assistant-only fields
	Interpretation  *Interpretation `json:"interpretation,omitempty"`
	SQLQuery        *string         `json:"sqlQuery,omitempty"`
	ExecutionTimeMs *int32          `json:"executionTimeMs,omitempty"`
	RowCount        *int32          `json:"rowCount,omitempty"`
	ColCount        *int32          `json:"colCount,omitempty"`
	Result          *QueryResult    `json:"result,omitempty"`
	IsCached        bool            `json:"isCached"`
	Error           *string         `json:"error,omitempty"`
}

// ToMessageResponse converts a store.Message to the rich client format.
func ToMessageResponse(m store.Message) MessageResponse {
	resp := MessageResponse{
		ID:        uuidStr(m.ID),
		Role:      m.Role,
		Content:   m.Content,
		InputMode: m.InputMode,
		IsCached:  m.IsCached,
		CreatedAt: m.CreatedAt.Time,
	}

	if m.SqlQuery.Valid {
		resp.SQLQuery = &m.SqlQuery.String
	}
	if m.ExecutionTimeMs.Valid {
		resp.ExecutionTimeMs = &m.ExecutionTimeMs.Int32
	}
	if m.RowCount.Valid {
		resp.RowCount = &m.RowCount.Int32
	}
	if m.ColCount.Valid {
		resp.ColCount = &m.ColCount.Int32
	}
	if m.Error.Valid {
		resp.Error = &m.Error.String
	}

	if len(m.Interpretation) > 0 {
		var interp Interpretation
		if json.Unmarshal(m.Interpretation, &interp) == nil {
			resp.Interpretation = &interp
		}
	}
	if len(m.ResultData) > 0 {
		var result QueryResult
		if json.Unmarshal(m.ResultData, &result) == nil {
			resp.Result = &result
		}
	}

	return resp
}

// --- HTTP request types -----------------------------------------------------

type CreateConversationSchema struct {
	ConnectionID string `json:"connection_id" binding:"required,uuid"`
	Title        string `json:"title"`
}

type QuerySchema struct {
	Message string `json:"message" binding:"required,min=1,max=4000"`
}

// --- Helpers ----------------------------------------------------------------

func uuidStr(id pgtype.UUID) string {
	if !id.Valid {
		return ""
	}
	b := id.Bytes
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
