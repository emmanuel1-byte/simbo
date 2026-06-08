package conversation_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"simbo-api-service/internal/database/store"
	"simbo-api-service/internal/modules/conversation"
)

func init() { gin.SetMode(gin.TestMode) }

// ---------------------------------------------------------------------------
// Guardrails — pure unit tests, no mocks
// ---------------------------------------------------------------------------

func TestValidateSQL(t *testing.T) {
	t.Parallel()

	pass := []string{
		`SELECT * FROM users`,
		`select id, email from users where status = 'active'`,
		`WITH cte AS (SELECT id FROM orders) SELECT * FROM cte`,
		`SELECT * FROM users WHERE note = 'contains DELETE word inside string'`,
		`-- read-only · validated · safe-mode
SELECT date_trunc('week', created_at) AS week, count(*) AS signups
FROM users WHERE status = 'active'
GROUP BY 1 ORDER BY 1 DESC`,
	}
	for _, sql := range pass {
		assert.NoError(t, conversation.ValidateSQL(sql), "should pass: %q", truncate(sql))
	}

	block := []string{
		`INSERT INTO users (email) VALUES ('x@x.com')`,
		`UPDATE users SET email='x' WHERE id=1`,
		`DELETE FROM users WHERE id=1`,
		`DROP TABLE users`,
		`CREATE TABLE foo (id int)`,
		`ALTER TABLE users ADD COLUMN foo TEXT`,
		`TRUNCATE users`,
		`SELECT * FROM users; DROP TABLE users`,
		`SELECT pg_read_file('/etc/passwd')`,
		`SELECT PG_SLEEP(30)`,
		`EXECUTE my_proc()`,
	}
	for _, sql := range block {
		assert.Error(t, conversation.ValidateSQL(sql), "should block: %q", truncate(sql))
	}
}

func truncate(s string) string {
	if len(s) > 40 {
		return s[:40]
	}
	return s
}

// ---------------------------------------------------------------------------
// Cache — pure unit tests
// ---------------------------------------------------------------------------

func TestCache(t *testing.T) {
	t.Parallel()

	c := conversation.NewCache[string]()
	c.Set("k", "hello", 100*time.Millisecond)

	v, ok := c.Get("k")
	assert.True(t, ok)
	assert.Equal(t, "hello", v)

	time.Sleep(150 * time.Millisecond)
	_, ok = c.Get("k")
	assert.False(t, ok, "entry should have expired")
}

func TestResultCacheKey(t *testing.T) {
	assert.Equal(t, conversation.ResultCacheKey("c", "s"), conversation.ResultCacheKey("c", "s"))
	assert.NotEqual(t, conversation.ResultCacheKey("c1", "s"), conversation.ResultCacheKey("c2", "s"))
}

// ---------------------------------------------------------------------------
// ToMessageResponse — unit tests
// ---------------------------------------------------------------------------

func TestToMessageResponse(t *testing.T) {
	t.Parallel()

	interp := `{"summary":"test","tags":[]}`
	result := `{"columns":["id"],"rows":[[1]]}`

	m := store.Message{
		ID:              mustUUID(t, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
		Role:            "assistant",
		Content:         "Summary text",
		InputMode:       "text",
		Interpretation:  []byte(interp),
		ResultData:      []byte(result),
		SqlQuery:        pgtype.Text{String: "SELECT 1", Valid: true},
		ExecutionTimeMs: pgtype.Int4{Int32: 238, Valid: true},
		RowCount:        pgtype.Int4{Int32: 2, Valid: true},
		ColCount:        pgtype.Int4{Int32: 1, Valid: true},
		IsCached:        false,
	}

	resp := conversation.ToMessageResponse(m)
	assert.Equal(t, "assistant", resp.Role)
	assert.Equal(t, "text", resp.InputMode)
	assert.NotNil(t, resp.Interpretation)
	assert.Equal(t, "test", resp.Interpretation.Summary)
	assert.NotNil(t, resp.Result)
	assert.Equal(t, []string{"id"}, resp.Result.Columns)
	require.NotNil(t, resp.SQLQuery)
	assert.Equal(t, "SELECT 1", *resp.SQLQuery)
	assert.EqualValues(t, 238, *resp.ExecutionTimeMs)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func mustUUID(t *testing.T, s string) pgtype.UUID {
	t.Helper()
	var id pgtype.UUID
	require.NoError(t, id.Scan(s))
	return id
}

var (
	uid    = func(t *testing.T) pgtype.UUID { return mustUUID(t, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa") }
	convID = func(t *testing.T) pgtype.UUID { return mustUUID(t, "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb") }
	connID = func(t *testing.T) pgtype.UUID { return mustUUID(t, "cccccccc-cccc-cccc-cccc-cccccccccccc") }
)

func newRouter(method, path string, handler gin.HandlerFunc, mws ...gin.HandlerFunc) *gin.Engine {
	r := gin.New()
	r.Handle(method, path, append(mws, handler)...)
	return r
}

func performRequest(r *gin.Engine, method, path string, body any) *httptest.ResponseRecorder {
	var buf bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&buf).Encode(body)
	}
	req := httptest.NewRequest(method, path, &buf)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func multipartRequest(r *gin.Engine, method, path string, fieldName, filename string, audioData []byte) *httptest.ResponseRecorder {
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	fw, _ := mw.CreateFormFile(fieldName, filename)
	_, _ = io.Copy(fw, bytes.NewReader(audioData))
	mw.Close()

	req := httptest.NewRequest(method, path, &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func injectSub(id pgtype.UUID) gin.HandlerFunc {
	return func(c *gin.Context) { c.Set("sub", id); c.Next() }
}

// noopDecryptor satisfies conversation.Decryptor without decrypting anything.
type noopDecryptor struct{}

func (noopDecryptor) Decrypt(s string) (string, error) { return s, nil }

func newHandler(q *MockQuerier, pl *MockPipeline) *conversation.Handler {
	return conversation.NewHandler(q, noopDecryptor{}, pl)
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

type MockQuerier struct{ mock.Mock }

func (m *MockQuerier) CreateConversation(ctx context.Context, p store.CreateConversationParams) (store.Conversation, error) {
	args := m.Called(ctx, p)
	return args.Get(0).(store.Conversation), args.Error(1)
}
func (m *MockQuerier) GetConversation(ctx context.Context, p store.GetConversationParams) (store.Conversation, error) {
	args := m.Called(ctx, p)
	return args.Get(0).(store.Conversation), args.Error(1)
}
func (m *MockQuerier) ListConversations(ctx context.Context, id pgtype.UUID) ([]store.ListConversationsRow, error) {
	args := m.Called(ctx, id)
	return args.Get(0).([]store.ListConversationsRow), args.Error(1)
}
func (m *MockQuerier) TouchConversation(ctx context.Context, id pgtype.UUID) error {
	return m.Called(ctx, id).Error(0)
}
func (m *MockQuerier) DeleteConversation(ctx context.Context, p store.DeleteConversationParams) error {
	return m.Called(ctx, p).Error(0)
}
func (m *MockQuerier) CreateMessage(ctx context.Context, p store.CreateMessageParams) (store.Message, error) {
	args := m.Called(ctx, p)
	return args.Get(0).(store.Message), args.Error(1)
}
func (m *MockQuerier) ListMessages(ctx context.Context, id pgtype.UUID) ([]store.Message, error) {
	args := m.Called(ctx, id)
	return args.Get(0).([]store.Message), args.Error(1)
}
func (m *MockQuerier) GetConnectionByID(ctx context.Context, p store.GetConnectionByIDParams) (store.Connection, error) {
	args := m.Called(ctx, p)
	return args.Get(0).(store.Connection), args.Error(1)
}
func (m *MockQuerier) GetActiveAPIKey(ctx context.Context, id pgtype.UUID) (store.ApiKey, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(store.ApiKey), args.Error(1)
}
func (m *MockQuerier) TouchAPIKey(ctx context.Context, id pgtype.UUID) error {
	return m.Called(ctx, id).Error(0)
}

type MockPipeline struct{ mock.Mock }

func (m *MockPipeline) Run(ctx context.Context, input conversation.PipelineInput, out chan<- conversation.StreamEvent) {
	m.Called(ctx, input, out)
}

// ---------------------------------------------------------------------------
// CreateConversation
// ---------------------------------------------------------------------------

func TestCreateConversation(t *testing.T) {
	t.Parallel()
	u, c, cn := uid(t), convID(t), connID(t)
	body := map[string]string{"connection_id": cn.String(), "title": "Weekly signups"}

	t.Run("201 – creates conversation", func(t *testing.T) {
		q := new(MockQuerier)
		q.On("CreateConversation", mock.Anything, mock.MatchedBy(func(p store.CreateConversationParams) bool {
			return p.UserID == u && p.ConnectionID == cn
		})).Return(store.Conversation{ID: c, UserID: u, ConnectionID: cn}, nil)

		h := newHandler(q, new(MockPipeline))
		r := newRouter(http.MethodPost, "/conversations", h.CreateConversation, injectSub(u))
		w := performRequest(r, http.MethodPost, "/conversations", body)
		assert.Equal(t, http.StatusCreated, w.Code)
		q.AssertExpectations(t)
	})

	t.Run("400 – missing connection_id", func(t *testing.T) {
		h := newHandler(new(MockQuerier), new(MockPipeline))
		r := newRouter(http.MethodPost, "/conversations", h.CreateConversation, injectSub(u))
		w := performRequest(r, http.MethodPost, "/conversations", map[string]string{})
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}

// ---------------------------------------------------------------------------
// ListConversations
// ---------------------------------------------------------------------------

func TestListConversations(t *testing.T) {
	t.Parallel()
	u := uid(t)

	t.Run("200 – returns list", func(t *testing.T) {
		q := new(MockQuerier)
		q.On("ListConversations", mock.Anything, u).
			Return([]store.ListConversationsRow{{ID: convID(t), ConnectionName: "prod"}}, nil)

		h := newHandler(q, new(MockPipeline))
		r := newRouter(http.MethodGet, "/conversations", h.ListConversations, injectSub(u))
		w := performRequest(r, http.MethodGet, "/conversations", nil)
		assert.Equal(t, http.StatusOK, w.Code)
		var resp map[string]any
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		assert.Len(t, resp["data"].([]any), 1)
	})

	t.Run("500 – DB error", func(t *testing.T) {
		q := new(MockQuerier)
		q.On("ListConversations", mock.Anything, u).
			Return([]store.ListConversationsRow{}, errors.New("db error"))

		h := newHandler(q, new(MockPipeline))
		r := newRouter(http.MethodGet, "/conversations", h.ListConversations, injectSub(u))
		w := performRequest(r, http.MethodGet, "/conversations", nil)
		assert.Equal(t, http.StatusInternalServerError, w.Code)
	})
}

// ---------------------------------------------------------------------------
// ListMessages
// ---------------------------------------------------------------------------

func TestListMessages(t *testing.T) {
	t.Parallel()
	u, c := uid(t), convID(t)

	makeMsg := func(role, mode string) store.Message {
		return store.Message{
			ID:        mustUUID(t, "dddddddd-dddd-dddd-dddd-dddddddddddd"),
			Role:      role,
			Content:   fmt.Sprintf("%s message", role),
			InputMode: mode,
		}
	}

	t.Run("200 – returns rich message list", func(t *testing.T) {
		q := new(MockQuerier)
		q.On("GetConversation", mock.Anything, store.GetConversationParams{ID: c, UserID: u}).
			Return(store.Conversation{ID: c, UserID: u}, nil)
		q.On("ListMessages", mock.Anything, c).
			Return([]store.Message{
				makeMsg("user", "text"),
				makeMsg("user", "voice"),
				makeMsg("assistant", "text"),
			}, nil)

		h := newHandler(q, new(MockPipeline))
		r := newRouter(http.MethodGet, "/conversations/:id/messages", h.ListMessages, injectSub(u))
		w := performRequest(r, http.MethodGet, "/conversations/"+c.String()+"/messages", nil)

		assert.Equal(t, http.StatusOK, w.Code)
		var resp map[string]any
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))

		msgs := resp["data"].([]any)
		assert.Len(t, msgs, 3)

		first := msgs[0].(map[string]any)
		assert.Equal(t, "user", first["role"])
		assert.Equal(t, "text", first["inputMode"])

		second := msgs[1].(map[string]any)
		assert.Equal(t, "voice", second["inputMode"])

		q.AssertExpectations(t)
	})

	t.Run("404 – conversation not found", func(t *testing.T) {
		q := new(MockQuerier)
		q.On("GetConversation", mock.Anything, mock.Anything).
			Return(store.Conversation{}, pgx.ErrNoRows)

		h := newHandler(q, new(MockPipeline))
		r := newRouter(http.MethodGet, "/conversations/:id/messages", h.ListMessages, injectSub(u))
		w := performRequest(r, http.MethodGet, "/conversations/"+c.String()+"/messages", nil)
		assert.Equal(t, http.StatusNotFound, w.Code)
	})
}

// ---------------------------------------------------------------------------
// Query (text SSE)
// ---------------------------------------------------------------------------

func TestQuery(t *testing.T) {
	t.Parallel()
	u, c := uid(t), convID(t)

	t.Run("streams step + done events", func(t *testing.T) {
		pl := new(MockPipeline)
		pl.On("Run", mock.Anything, conversation.PipelineInput{
			ConversationID: c, UserID: u,
			Message: "Show me weekly signups", InputMode: conversation.InputModeText,
		}, mock.Anything).Run(func(args mock.Arguments) {
			out := args.Get(2).(chan<- conversation.StreamEvent)
			out <- conversation.StreamEvent{Kind: conversation.KindStep, Data: conversation.StepPayload{Phase: conversation.PhaseParseIntent}}
			out <- conversation.StreamEvent{Kind: conversation.KindDone, Data: conversation.DonePayload{TotalMs: 500}}
		})

		h := newHandler(new(MockQuerier), pl)
		r := newRouter(http.MethodPost, "/conversations/:id/query", h.Query, injectSub(u))
		w := performRequest(r, http.MethodPost, "/conversations/"+c.String()+"/query",
			map[string]string{"message": "Show me weekly signups"})

		assert.Equal(t, http.StatusOK, w.Code)
		body := w.Body.String()
		assert.Contains(t, body, PhaseParseIntent)
		assert.Contains(t, body, "done")
		pl.AssertExpectations(t)
	})

	t.Run("400 – missing message", func(t *testing.T) {
		h := newHandler(new(MockQuerier), new(MockPipeline))
		r := newRouter(http.MethodPost, "/conversations/:id/query", h.Query, injectSub(u))
		w := performRequest(r, http.MethodPost, "/conversations/"+c.String()+"/query", map[string]string{})
		assert.Contains(t, w.Body.String(), "error")
	})
}

// ---------------------------------------------------------------------------
// VoiceQuery
// ---------------------------------------------------------------------------

func TestVoiceQuery(t *testing.T) {
	t.Parallel()
	u, c := uid(t), convID(t)

	t.Run("400 – no audio file", func(t *testing.T) {
		h := newHandler(new(MockQuerier), new(MockPipeline))
		r := newRouter(http.MethodPost, "/conversations/:id/query/voice", h.VoiceQuery, injectSub(u))
		req := httptest.NewRequest(http.MethodPost, "/conversations/"+c.String()+"/query/voice", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		// SSE response — body must contain an error event
		assert.Contains(t, w.Body.String(), "error")
	})

	t.Run("streams transcribing step on valid audio", func(t *testing.T) {
		q := new(MockQuerier)
		// API key is OpenAI
		q.On("GetActiveAPIKey", mock.Anything, u).
			Return(store.ApiKey{Provider: "openai", KeyEncrypted: "sk-test"}, nil)

		pl := new(MockPipeline)
		// Pipeline is called with voice mode and the transcription
		// (Whisper call will fail since we have a fake key, so we just verify the error event)

		h := newHandler(q, pl)
		r := newRouter(http.MethodPost, "/conversations/:id/query/voice", h.VoiceQuery, injectSub(u))
		w := multipartRequest(r, http.MethodPost, "/conversations/"+c.String()+"/query/voice",
			"audio", "recording.webm", []byte("fake-audio-data"))

		// Whisper will fail (no real API key) but the transcribing step must be emitted first
		body := w.Body.String()
		assert.Contains(t, body, conversation.PhaseTranscribing)
	})

	t.Run("error – no active API key", func(t *testing.T) {
		q := new(MockQuerier)
		q.On("GetActiveAPIKey", mock.Anything, u).Return(store.ApiKey{}, pgx.ErrNoRows)

		h := newHandler(q, new(MockPipeline))
		r := newRouter(http.MethodPost, "/conversations/:id/query/voice", h.VoiceQuery, injectSub(u))
		w := multipartRequest(r, http.MethodPost, "/conversations/"+c.String()+"/query/voice",
			"audio", "r.webm", []byte("data"))
		assert.Contains(t, w.Body.String(), "error")
	})

	t.Run("error – non-OpenAI key", func(t *testing.T) {
		q := new(MockQuerier)
		q.On("GetActiveAPIKey", mock.Anything, u).
			Return(store.ApiKey{Provider: "anthropic", KeyEncrypted: "sk-ant-test"}, nil)

		h := newHandler(q, new(MockPipeline))
		r := newRouter(http.MethodPost, "/conversations/:id/query/voice", h.VoiceQuery, injectSub(u))
		w := multipartRequest(r, http.MethodPost, "/conversations/"+c.String()+"/query/voice",
			"audio", "r.webm", []byte("data"))
		assert.Contains(t, w.Body.String(), "OpenAI")
	})
}

const (
	PhaseParseIntent  = conversation.PhaseParseIntent
	PhaseTranscribing = conversation.PhaseTranscribing
)
