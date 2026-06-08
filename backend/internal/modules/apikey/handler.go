package apikey

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"simbo-api-service/internal/database/store"
	"simbo-api-service/internal/modules/connection"
	"simbo-api-service/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// Querier is the database interface required by apikey handlers.
type Querier interface {
	SaveAPIKey(ctx context.Context, p store.SaveAPIKeyParams) (store.ApiKey, error)
	GetActiveAPIKey(ctx context.Context, userID pgtype.UUID) (store.ApiKey, error)
	RotateAPIKey(ctx context.Context, p store.RotateAPIKeyParams) (store.ApiKey, error)
	RevokeAPIKey(ctx context.Context, userID pgtype.UUID) error
	TouchAPIKey(ctx context.Context, id pgtype.UUID) error
}

// Handler holds the apikey handler dependencies.
type Handler struct {
	q   Querier
	enc connection.Encryptor
}

// NewHandler constructs a Handler.
func NewHandler(q Querier, enc connection.Encryptor) *Handler {
	return &Handler{q: q, enc: enc}
}

// AddKey saves a new LLM API key for the authenticated user.
func (h *Handler) AddKey(c *gin.Context) {
	var body AddKeySchema
	if err := c.ShouldBindJSON(&body); err != nil {
		utils.BadRequestError(c, err.Error())
		return
	}

	userID := c.MustGet("sub").(pgtype.UUID)

	encrypted, err := h.enc.Encrypt(body.Key)
	if err != nil {
		utils.InternalServerError(c, err)
		return
	}

	k, err := h.q.SaveAPIKey(c, store.SaveAPIKeyParams{
		UserID:       userID,
		Provider:     body.Provider,
		Model:        body.Model,
		KeyEncrypted: encrypted,
		KeyHint:      keyHint(body.Key),
	})
	if err != nil {
		utils.ConflictError(c, "An active API key already exists. Rotate or revoke it first.")
		return
	}

	c.JSON(http.StatusCreated, utils.Response{
		Success: true,
		Data:    safeKey(k),
	})
}

// GetActiveKey returns the current active key (without the real value).
func (h *Handler) GetActiveKey(c *gin.Context) {
	userID := c.MustGet("sub").(pgtype.UUID)

	k, err := h.q.GetActiveAPIKey(c, userID)
	if err != nil {
		if isNotFound(err) {
			utils.NotFoundError(c, "No active API key configured.")
			return
		}
		utils.InternalServerError(c, err)
		return
	}

	c.JSON(http.StatusOK, utils.Response{
		Success: true,
		Data:    safeKey(k),
	})
}

// TestKey validates that the stored key can reach the LLM provider.
func (h *Handler) TestKey(c *gin.Context) {
	userID := c.MustGet("sub").(pgtype.UUID)

	k, err := h.q.GetActiveAPIKey(c, userID)
	if err != nil {
		utils.NotFoundError(c, "No active API key configured.")
		return
	}

	plain, err := h.enc.Decrypt(k.KeyEncrypted)
	if err != nil {
		utils.InternalServerError(c, err)
		return
	}

	testCtx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	if err = pingProvider(testCtx, fmt.Sprint(k.Provider), plain); err != nil {
		utils.BadRequestError(c, "Key validation failed: "+err.Error())
		return
	}

	_ = h.q.TouchAPIKey(c, k.ID)

	c.JSON(http.StatusOK, utils.Response{
		Success: true,
		Data:    gin.H{"message": "API key is valid", "provider": k.Provider, "model": k.Model},
	})
}

// RotateKey replaces the encrypted key value (keeps the same record active).
func (h *Handler) RotateKey(c *gin.Context) {
	var body RotateKeySchema
	if err := c.ShouldBindJSON(&body); err != nil {
		utils.BadRequestError(c, err.Error())
		return
	}

	userID := c.MustGet("sub").(pgtype.UUID)

	encrypted, err := h.enc.Encrypt(body.Key)
	if err != nil {
		utils.InternalServerError(c, err)
		return
	}

	k, err := h.q.RotateAPIKey(c, store.RotateAPIKeyParams{
		UserID:       userID,
		KeyEncrypted: encrypted,
		KeyHint:      keyHint(body.Key),
		Model:        body.Model,
	})
	if err != nil {
		utils.NotFoundError(c, "No active API key to rotate.")
		return
	}

	c.JSON(http.StatusOK, utils.Response{
		Success: true,
		Data:    safeKey(k),
	})
}

// RevokeKey deactivates the current API key immediately.
func (h *Handler) RevokeKey(c *gin.Context) {
	userID := c.MustGet("sub").(pgtype.UUID)

	if err := h.q.RevokeAPIKey(c, userID); err != nil {
		utils.InternalServerError(c, err)
		return
	}

	c.JSON(http.StatusOK, utils.Response{
		Success: true,
		Data:    gin.H{"message": "API key revoked. Past results are preserved."},
	})
}

// --- helpers ----------------------------------------------------------------

// safeKey strips the encrypted key before sending to the client.
func safeKey(k store.ApiKey) gin.H {
	return gin.H{
		"id":         k.ID,
		"provider":   k.Provider,
		"model":      k.Model,
		"keyHint":    k.KeyHint,
		"isActive":   k.IsActive,
		"lastUsedAt": k.LastUsedAt,
		"createdAt":  k.CreatedAt,
	}
}

// keyHint returns a masked display string: "····{last4}".
func keyHint(key string) string {
	if len(key) < 4 {
		return "····"
	}
	return "····" + key[len(key)-4:]
}

func isNotFound(err error) bool {
	return err == pgx.ErrNoRows
}
