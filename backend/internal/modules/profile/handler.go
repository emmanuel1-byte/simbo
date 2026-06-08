package profile

import (
	"context"
	"net/http"

	"simbo-api-service/internal/database/store"
	"simbo-api-service/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgtype"
)

// Querier is the database interface required by the profile handlers.
// It is satisfied by *store.Queries and can be mocked in tests.
type Querier interface {
	GetUserByID(ctx context.Context, id pgtype.UUID) (store.User, error)
	UpdateUserProfile(ctx context.Context, p store.UpdateUserProfileParams) (store.UpdateUserProfileRow, error)
}

// Handler holds the profile handler dependencies.
type Handler struct {
	q Querier
}

// NewHandler constructs a Handler.
func NewHandler(q Querier) *Handler {
	return &Handler{q: q}
}

func (h *Handler) GetProfile(c *gin.Context) {
	user, err := h.q.GetUserByID(c, c.MustGet("sub").(pgtype.UUID))
	if err != nil {
		utils.NotFoundError(c, "Account not found")
		return
	}

	c.JSON(http.StatusOK, utils.Response{
		Success: true,
		Data: gin.H{
			"fullname": user.Fullname,
			"email":    user.Email,
		},
	})
}

func (h *Handler) UpdateProfile(c *gin.Context) {
	var body UpdateProfileSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		utils.BadRequestError(c, err.Error())
		return
	}

	existingUser, err := h.q.GetUserByID(c, c.MustGet("sub").(pgtype.UUID))
	if err != nil {
		utils.NotFoundError(c, "Account not found")
		return
	}

	updatedUser, err := h.q.UpdateUserProfile(c, store.UpdateUserProfileParams{
		ID:       existingUser.ID,
		Fullname: body.FullName,
		Email:    body.Email,
	})
	if err != nil {
		utils.InternalServerError(c, err)
		return
	}

	c.JSON(http.StatusOK, utils.Response{
		Success: true,
		Data: gin.H{
			"fullname": updatedUser.Fullname,
			"email":    updatedUser.Email,
		},
	})
}
