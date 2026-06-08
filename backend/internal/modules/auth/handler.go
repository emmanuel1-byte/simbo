package auth

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"simbo-api-service/internal/database/store"
	"simbo-api-service/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"golang.org/x/crypto/bcrypt"
)

const (
	otpTypeEmailVerification = "email_verification"
	otpTypePasswordReset     = "password_reset"
)

// Querier is the database interface required by the auth handlers.
// It is satisfied by *store.Queries and can be mocked in tests.
type Querier interface {
	GetUserByEmail(ctx context.Context, email string) (store.User, error)
	GetUserByID(ctx context.Context, id pgtype.UUID) (store.User, error)
	CreateUser(ctx context.Context, p store.CreateUserParams) (store.CreateUserRow, error)
	CreateOtp(ctx context.Context, p store.CreateOtpParams) (store.CreateOtpRow, error)
	CreateWorkspace(ctx context.Context, userID pgtype.UUID) (store.Workspace, error)
	GetValidOtp(ctx context.Context, p store.GetValidOtpParams) (store.Otp, error)
	InvalidateOtpsByType(ctx context.Context, p store.InvalidateOtpsByTypeParams) error
	UpdateUserVerified(ctx context.Context, p store.UpdateUserVerifiedParams) (store.UpdateUserVerifiedRow, error)
	ConsumeOtp(ctx context.Context, id pgtype.UUID) (store.ConsumeOtpRow, error)
	UpdateLastLogin(ctx context.Context, id pgtype.UUID) error
	UpdateUserPassword(ctx context.Context, p store.UpdateUserPasswordParams) (store.UpdateUserPasswordRow, error)
}

// DBConn is the database connection interface required for transaction support.
// It is satisfied by *pgx.Conn.
type DBConn interface {
	Begin(ctx context.Context) (pgx.Tx, error)
}

// SendMailFunc delivers an email asynchronously. Pass nil to disable (e.g. in tests).
type SendMailFunc func(to, template string, data map[string]interface{})

// Handler holds the auth handler dependencies.
type Handler struct {
	q      Querier
	db     DBConn
	newTxQ func(pgx.Tx) Querier
	mail   SendMailFunc
}

// NewHandler constructs a Handler.
// newTxQ is a factory that wraps a transaction in a Querier — in production this is
// func(tx pgx.Tx) Querier { return queries.WithTx(tx) }.
func NewHandler(q Querier, db DBConn, newTxQ func(pgx.Tx) Querier, mail SendMailFunc) *Handler {
	return &Handler{q: q, db: db, newTxQ: newTxQ, mail: mail}
}

func (h *Handler) Signup(c *gin.Context) {
	var body SignupSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		utils.BadRequestError(c, err.Error())
		return
	}

	_, err := h.q.GetUserByEmail(c, body.Email)
	if err == nil {
		utils.ConflictError(c, "An account with this email already exists.")
		return
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		utils.InternalServerError(c, err)
		return
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		utils.InternalServerError(c, err)
		return
	}

	tx, err := h.db.Begin(c)
	if err != nil {
		utils.InternalServerError(c, err)
		return
	}
	defer tx.Rollback(c)

	qtx := h.newTxQ(tx)

	newUser, err := qtx.CreateUser(c, store.CreateUserParams{
		Fullname:     body.FullName,
		Email:        body.Email,
		PasswordHash: string(passwordHash),
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			utils.ConflictError(c, "An account with this email already exists.")
			return
		}
		utils.InternalServerError(c, err)
		return
	}

	otp, err := utils.GenerateSecureOtp()
	if err != nil {
		utils.InternalServerError(c, err)
		return
	}

	otpHash, err := bcrypt.GenerateFromPassword([]byte(otp), bcrypt.DefaultCost)
	if err != nil {
		utils.InternalServerError(c, err)
		return
	}

	_, err = qtx.CreateOtp(c, store.CreateOtpParams{
		UserID:    newUser.ID,
		OtpHash:   string(otpHash),
		Type:      otpTypeEmailVerification,
		ExpiresAt: pgtype.Timestamptz{Time: time.Now().Add(5 * time.Minute), Valid: true},
	})
	if err != nil {
		utils.InternalServerError(c, err)
		return
	}

	_, err = qtx.CreateWorkspace(c, newUser.ID)
	if err != nil {
		utils.InternalServerError(c, err)
		return
	}

	if err = tx.Commit(c); err != nil {
		utils.InternalServerError(c, err)
		return
	}

	if h.mail != nil {
		h.mail(body.Email, "sign-up", map[string]interface{}{
			"firstName": strings.Split(body.FullName, " ")[0],
			"otp":       otp,
		})
	}

	c.JSON(http.StatusCreated, utils.Response{
		Success: true,
		Data: gin.H{
			"message": "Account created successfully. Please verify your email to continue.",
			"user":    newUser,
		},
	})
}

func (h *Handler) RequestOtp(c *gin.Context) {
	var body RequestOtpSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		utils.BadRequestError(c, err.Error())
		return
	}

	existingUser, err := h.q.GetUserByEmail(c, body.Email)
	if err != nil {
		utils.NotFoundError(c, "Unable to process OTP request.")
		return
	}

	if err = h.q.InvalidateOtpsByType(c, store.InvalidateOtpsByTypeParams{
		UserID: existingUser.ID,
		Type:   otpTypeEmailVerification,
	}); err != nil {
		utils.InternalServerError(c, err)
		return
	}

	otp, err := utils.GenerateSecureOtp()
	if err != nil {
		utils.InternalServerError(c, err)
		return
	}

	otpHash, err := bcrypt.GenerateFromPassword([]byte(otp), bcrypt.DefaultCost)
	if err != nil {
		utils.InternalServerError(c, err)
		return
	}

	_, err = h.q.CreateOtp(c, store.CreateOtpParams{
		UserID:    existingUser.ID,
		OtpHash:   string(otpHash),
		Type:      otpTypeEmailVerification,
		ExpiresAt: pgtype.Timestamptz{Time: time.Now().Add(5 * time.Minute), Valid: true},
	})
	if err != nil {
		utils.InternalServerError(c, err)
		return
	}

	if h.mail != nil {
		h.mail(body.Email, "request-otp", map[string]interface{}{"otp": otp})
	}

	c.JSON(http.StatusOK, utils.Response{
		Success: true,
		Data:    gin.H{"message": "A verification code has been sent to your email address."},
	})
}

func (h *Handler) Login(c *gin.Context) {
	var body LoginSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		utils.BadRequestError(c, err.Error())
		return
	}

	existingUser, err := h.q.GetUserByEmail(c, body.Email)
	if err != nil {
		utils.NotFoundError(c, "Invalid credentials")
		return
	}

	if !existingUser.Verified {
		utils.BadRequestError(c, "Account verification pending. Please verify your account with the OTP sent to your email or request a new OTP")
		return
	}

	if err = bcrypt.CompareHashAndPassword([]byte(existingUser.PasswordHash), []byte(body.Password)); err != nil {
		utils.BadRequestError(c, "Invalid credentials")
		return
	}

	if err = h.q.UpdateLastLogin(c, existingUser.ID); err != nil {
		utils.InternalServerError(c, err)
		return
	}

	accessToken, err := utils.CreateAccessToken(existingUser.ID.String())
	if err != nil {
		utils.InternalServerError(c, err)
		return
	}

	refreshToken, err := utils.CreateRefreshToken(existingUser.ID.String())
	if err != nil {
		utils.InternalServerError(c, err)
		return
	}

	c.JSON(http.StatusOK, utils.Response{
		Success: true,
		Data: gin.H{
			"user":         existingUser,
			"accessToken":  accessToken,
			"refreshToken": refreshToken,
		},
	})
}

func (h *Handler) VerifyOtp(c *gin.Context) {
	var body VerifyOtpSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		utils.BadRequestError(c, err.Error())
		return
	}

	existingUser, err := h.q.GetUserByEmail(c, body.Email)
	if err != nil {
		utils.NotFoundError(c, "Invalid or expired verification request.")
		return
	}

	existingOtp, err := h.q.GetValidOtp(c, store.GetValidOtpParams{
		UserID: existingUser.ID,
		Type:   otpTypeEmailVerification,
	})
	if err != nil {
		utils.NotFoundError(c, "Invalid or expired verification request.")
		return
	}

	if err = bcrypt.CompareHashAndPassword([]byte(existingOtp.OtpHash), []byte(body.Otp)); err != nil {
		utils.BadRequestError(c, "Invalid verification code.")
		return
	}

	if _, err = h.q.UpdateUserVerified(c, store.UpdateUserVerifiedParams{
		ID:       existingUser.ID,
		Verified: true,
	}); err != nil {
		utils.InternalServerError(c, err)
		return
	}

	if _, err = h.q.ConsumeOtp(c, existingOtp.ID); err != nil {
		utils.InternalServerError(c, err)
		return
	}

	c.JSON(http.StatusOK, utils.Response{
		Success: true,
		Data:    gin.H{"message": "Your email has been verified successfully."},
	})
}

func (h *Handler) RequestPasswordReset(c *gin.Context) {
	var body RequestPasswordResetSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		utils.BadRequestError(c, err.Error())
		return
	}

	existingUser, err := h.q.GetUserByEmail(c, body.Email)
	if err != nil {
		utils.NotFoundError(c, "Unable to process password reset request.")
		return
	}

	if err = h.q.InvalidateOtpsByType(c, store.InvalidateOtpsByTypeParams{
		UserID: existingUser.ID,
		Type:   otpTypePasswordReset,
	}); err != nil {
		utils.InternalServerError(c, err)
		return
	}

	otp, err := utils.GenerateSecureOtp()
	if err != nil {
		utils.InternalServerError(c, err)
		return
	}

	otpHash, err := bcrypt.GenerateFromPassword([]byte(otp), bcrypt.DefaultCost)
	if err != nil {
		utils.InternalServerError(c, err)
		return
	}

	_, err = h.q.CreateOtp(c, store.CreateOtpParams{
		UserID:    existingUser.ID,
		OtpHash:   string(otpHash),
		Type:      otpTypePasswordReset,
		ExpiresAt: pgtype.Timestamptz{Time: time.Now().Add(5 * time.Minute), Valid: true},
	})
	if err != nil {
		utils.InternalServerError(c, err)
		return
	}

	if h.mail != nil {
		h.mail(body.Email, "request-password-reset-otp", map[string]interface{}{"otp": otp})
	}

	c.JSON(http.StatusOK, utils.Response{
		Success: true,
		Data:    gin.H{"message": "A reset password code has been sent to your email address."},
	})
}

func (h *Handler) ResetPassword(c *gin.Context) {
	var body ResetPasswordSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		utils.BadRequestError(c, err.Error())
		return
	}

	existingUser, err := h.q.GetUserByEmail(c, body.Email)
	if err != nil {
		utils.NotFoundError(c, "Unable to process password reset request.")
		return
	}

	existingOtp, err := h.q.GetValidOtp(c, store.GetValidOtpParams{
		UserID: existingUser.ID,
		Type:   otpTypePasswordReset,
	})
	if err != nil {
		utils.NotFoundError(c, "Invalid or expired reset password request.")
		return
	}

	if err = bcrypt.CompareHashAndPassword([]byte(existingOtp.OtpHash), []byte(body.Otp)); err != nil {
		utils.BadRequestError(c, "Invalid reset code.")
		return
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		utils.InternalServerError(c, err)
		return
	}

	if _, err = h.q.UpdateUserPassword(c, store.UpdateUserPasswordParams{
		ID:           existingUser.ID,
		PasswordHash: string(passwordHash),
	}); err != nil {
		utils.InternalServerError(c, err)
		return
	}

	if _, err = h.q.ConsumeOtp(c, existingOtp.ID); err != nil {
		utils.InternalServerError(c, err)
		return
	}

	c.JSON(http.StatusOK, utils.Response{
		Success: true,
		Data:    gin.H{"message": "Password reset successfully."},
	})
}

func (h *Handler) RefreshToken(c *gin.Context) {
	var body RefreshTokenSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		utils.BadRequestError(c, err.Error())
		return
	}

	existingUser, err := h.q.GetUserByID(c, c.MustGet("sub").(pgtype.UUID))
	if err != nil {
		utils.NotFoundError(c, "Account not found")
		return
	}

	accessToken, err := utils.CreateAccessToken(existingUser.ID.String())
	if err != nil {
		utils.InternalServerError(c, err)
		return
	}

	refreshToken, err := utils.CreateRefreshToken(existingUser.ID.String())
	if err != nil {
		utils.InternalServerError(c, err)
		return
	}

	c.JSON(http.StatusOK, utils.Response{
		Success: true,
		Data: gin.H{
			"accessToken":  accessToken,
			"refreshToken": refreshToken,
		},
	})
}
