package conversation

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"simbo-api-service/internal/database/store"
	"simbo-api-service/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// Querier is the database interface required by conversation handlers.
type Querier interface {
	CreateConversation(ctx context.Context, p store.CreateConversationParams) (store.Conversation, error)
	GetConversation(ctx context.Context, p store.GetConversationParams) (store.Conversation, error)
	ListConversations(ctx context.Context, userID pgtype.UUID) ([]store.ListConversationsRow, error)
	TouchConversation(ctx context.Context, id pgtype.UUID) error
	DeleteConversation(ctx context.Context, p store.DeleteConversationParams) error
	CreateMessage(ctx context.Context, p store.CreateMessageParams) (store.Message, error)
	ListMessages(ctx context.Context, conversationID pgtype.UUID) ([]store.Message, error)
	GetConnectionByID(ctx context.Context, p store.GetConnectionByIDParams) (store.Connection, error)
	GetActiveAPIKey(ctx context.Context, userID pgtype.UUID) (store.ApiKey, error)
	TouchAPIKey(ctx context.Context, id pgtype.UUID) error
}

const errInvalidConvID = "invalid conversation id"

// Handler handles conversation HTTP requests.
type Handler struct {
	q        Querier
	dec      Decryptor
	pipeline PipelineRunner
}

// NewHandler constructs a Handler.
func NewHandler(q Querier, dec Decryptor, pipeline PipelineRunner) *Handler {
	return &Handler{q: q, dec: dec, pipeline: pipeline}
}

// ─── Conversations CRUD ───────────────────────────────────────────────────────

func (h *Handler) CreateConversation(c *gin.Context) {
	var body CreateConversationSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		utils.BadRequestError(c, err.Error())
		return
	}

	userID := c.MustGet("sub").(pgtype.UUID)
	var connID pgtype.UUID
	if err := connID.Scan(body.ConnectionID); err != nil {
		utils.BadRequestError(c, "invalid connection_id")
		return
	}

	conv, err := h.q.CreateConversation(c, store.CreateConversationParams{
		UserID:       userID,
		ConnectionID: connID,
		Title:        pgtype.Text{String: body.Title, Valid: body.Title != ""},
	})
	if err != nil {
		utils.InternalServerError(c, err)
		return
	}
	c.JSON(http.StatusCreated, utils.Response{Success: true, Data: conv})
}

func (h *Handler) ListConversations(c *gin.Context) {
	userID := c.MustGet("sub").(pgtype.UUID)
	rows, err := h.q.ListConversations(c, userID)
	if err != nil {
		utils.InternalServerError(c, err)
		return
	}
	if rows == nil {
		rows = []store.ListConversationsRow{}
	}
	c.JSON(http.StatusOK, utils.Response{Success: true, Data: rows})
}

func (h *Handler) GetConversation(c *gin.Context) {
	convID, err := parseUUID(c.Param("id"))
	if err != nil {
		utils.BadRequestError(c, errInvalidConvID)
		return
	}
	userID := c.MustGet("sub").(pgtype.UUID)

	conv, err := h.q.GetConversation(c, store.GetConversationParams{ID: convID, UserID: userID})
	if err != nil {
		utils.NotFoundError(c, "conversation not found")
		return
	}

	msgs, _ := h.q.ListMessages(c, convID)
	responses := toResponseList(msgs)

	c.JSON(http.StatusOK, utils.Response{
		Success: true,
		Data:    gin.H{"conversation": conv, "messages": responses},
	})
}

func (h *Handler) DeleteConversation(c *gin.Context) {
	convID, err := parseUUID(c.Param("id"))
	if err != nil {
		utils.BadRequestError(c, errInvalidConvID)
		return
	}
	userID := c.MustGet("sub").(pgtype.UUID)

	if err = h.q.DeleteConversation(c, store.DeleteConversationParams{ID: convID, UserID: userID}); err != nil {
		utils.InternalServerError(c, err)
		return
	}
	c.JSON(http.StatusOK, utils.Response{Success: true, Data: gin.H{"message": "conversation deleted"}})
}

// ─── Messages ────────────────────────────────────────────────────────────────

// ListMessages returns the full message history for a conversation as rich
// MessageResponse objects (JSONB fields are unmarshalled, nullable fields are
// typed pointers rather than raw pgtype values).
func (h *Handler) ListMessages(c *gin.Context) {
	convID, err := parseUUID(c.Param("id"))
	if err != nil {
		utils.BadRequestError(c, errInvalidConvID)
		return
	}
	userID := c.MustGet("sub").(pgtype.UUID)

	// Verify ownership
	if _, err = h.q.GetConversation(c, store.GetConversationParams{ID: convID, UserID: userID}); err != nil {
		utils.NotFoundError(c, "conversation not found")
		return
	}

	msgs, err := h.q.ListMessages(c, convID)
	if err != nil {
		utils.InternalServerError(c, err)
		return
	}

	c.JSON(http.StatusOK, utils.Response{Success: true, Data: toResponseList(msgs)})
}

// ─── Query endpoints (SSE) ────────────────────────────────────────────────────

// Query handles a text message and streams the pipeline response as SSE.
func (h *Handler) Query(c *gin.Context) {
	convID, err := parseUUID(c.Param("id"))
	if err != nil {
		sseError(c, PhaseParseIntent, errInvalidConvID)
		return
	}

	var body QuerySchema
	if err = c.ShouldBindJSON(&body); err != nil {
		sseError(c, PhaseParseIntent, err.Error())
		return
	}

	userID := c.MustGet("sub").(pgtype.UUID)
	setSSEHeaders(c)

	ctx, cancel := context.WithCancel(c.Request.Context())
	defer cancel()

	ch := make(chan StreamEvent, 32)
	go func() {
		defer close(ch)
		h.pipeline.Run(ctx, PipelineInput{
			ConversationID: convID,
			UserID:         userID,
			Message:        body.Message,
			InputMode:      InputModeText,
		}, ch)
	}()

	drainToSSE(c, ctx, ch)
}

// VoiceQuery accepts a multipart audio file, transcribes it with Whisper, then
// runs the same pipeline as Query. The Whisper transcription step is streamed
// as SSE steps before the pipeline begins.
func (h *Handler) VoiceQuery(c *gin.Context) {
	convID, err := parseUUID(c.Param("id"))
	if err != nil {
		sseError(c, PhaseTranscribing, errInvalidConvID)
		return
	}

	audioFile, header, err := c.Request.FormFile("audio")
	if err != nil {
		sseError(c, PhaseTranscribing, "audio file required (field: 'audio')")
		return
	}
	defer audioFile.Close()

	// Buffer the audio so the file handle can be closed before the goroutine runs
	audioData, err := io.ReadAll(audioFile)
	if err != nil {
		sseError(c, PhaseTranscribing, "failed to read audio")
		return
	}

	userID := c.MustGet("sub").(pgtype.UUID)
	setSSEHeaders(c)

	ctx, cancel := context.WithCancel(c.Request.Context())
	defer cancel()

	ch := make(chan StreamEvent, 32)
	go func() {
		defer close(ch)
		h.transcribeAndRun(ctx, userID, convID, header.Filename, audioData, ch)
	}()

	drainToSSE(c, ctx, ch)
}

// transcribeAndRun performs Whisper transcription then calls the pipeline.
// Runs inside the goroutine spawned by VoiceQuery.
func (h *Handler) transcribeAndRun(ctx context.Context, userID, convID pgtype.UUID, filename string, audio []byte, ch chan<- StreamEvent) {
	emit := func(kind string, data any) { ch <- StreamEvent{Kind: kind, Data: data} }

	emit(KindStep, StepPayload{Phase: PhaseTranscribing})

	// Load and decrypt the user's API key for Whisper
	apiKey, err := h.q.GetActiveAPIKey(ctx, userID)
	if err != nil {
		emit(KindError, ErrorPayload{Phase: PhaseTranscribing, Message: "no active API key — add one in Settings → API key"})
		return
	}
	if fmt.Sprint(apiKey.Provider) != "openai" {
		emit(KindError, ErrorPayload{Phase: PhaseTranscribing, Message: "voice transcription requires an OpenAI API key"})
		return
	}

	plainKey, err := h.dec.Decrypt(apiKey.KeyEncrypted)
	if err != nil {
		emit(KindError, ErrorPayload{Phase: PhaseTranscribing, Message: "API key decryption error"})
		return
	}

	transcription, err := TranscribeAudio(ctx, plainKey, bytes.NewReader(audio), filename)
	if err != nil {
		emit(KindError, ErrorPayload{Phase: PhaseTranscribing, Message: "transcription failed: " + err.Error()})
		return
	}

	emit(KindStep, StepPayload{Phase: PhaseTranscribed, Transcription: transcription})

	h.pipeline.Run(ctx, PipelineInput{
		ConversationID: convID,
		UserID:         userID,
		Message:        transcription,
		InputMode:      InputModeVoice,
	}, ch)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

func setSSEHeaders(c *gin.Context) {
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")
}

func sseError(c *gin.Context, phase, msg string) {
	setSSEHeaders(c)
	data, _ := json.Marshal(ErrorPayload{Phase: phase, Message: msg})
	fmt.Fprintf(c.Writer, "event: %s\ndata: %s\n\n", KindError, data)
}

func drainToSSE(c *gin.Context, ctx context.Context, ch <-chan StreamEvent) {
	flusher, canFlush := c.Writer.(http.Flusher)
	for {
		select {
		case <-ctx.Done():
			return
		case event, ok := <-ch:
			if !ok {
				return
			}
			data, _ := json.Marshal(event.Data)
			fmt.Fprintf(c.Writer, "event: %s\ndata: %s\n\n", event.Kind, data)
			if canFlush {
				flusher.Flush()
			}
		}
	}
}

func toResponseList(msgs []store.Message) []MessageResponse {
	if msgs == nil {
		return []MessageResponse{}
	}
	out := make([]MessageResponse, len(msgs))
	for i, m := range msgs {
		out[i] = ToMessageResponse(m)
	}
	return out
}

func parseUUID(s string) (pgtype.UUID, error) {
	var id pgtype.UUID
	return id, id.Scan(s)
}

func isNotFound(err error) bool { return err == pgx.ErrNoRows }
