package auth_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"

	"simbo-api-service/internal/database/store"
	"simbo-api-service/internal/modules/auth"
)

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

func init() {
	gin.SetMode(gin.TestMode)
}

func newRouter(method, path string, handler gin.HandlerFunc, mws ...gin.HandlerFunc) *gin.Engine {
	r := gin.New()
	chain := append(mws, handler)
	r.Handle(method, path, chain...)
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

func mustUUID(t *testing.T) pgtype.UUID {
	t.Helper()
	var id pgtype.UUID
	require.NoError(t, id.Scan("550e8400-e29b-41d4-a716-446655440000"))
	return id
}

func mustUUID2(t *testing.T) pgtype.UUID {
	t.Helper()
	var id pgtype.UUID
	require.NoError(t, id.Scan("660e8400-e29b-41d4-a716-446655440001"))
	return id
}

// mustHash hashes plain with MinCost (fast for tests).
func mustHash(t *testing.T, plain string) string {
	t.Helper()
	h, err := bcrypt.GenerateFromPassword([]byte(plain), bcrypt.MinCost)
	require.NoError(t, err)
	return string(h)
}

func futureTimestamp(d time.Duration) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: time.Now().Add(d), Valid: true}
}

// newHandler creates an auth.Handler wired to the given mocks.
// The same mockQ is used for both direct and transaction-scoped queries.
func newHandler(q *MockQueries, conn *MockConn) *auth.Handler {
	return auth.NewHandler(q, conn, func(tx pgx.Tx) auth.Querier {
		return q
	}, nil)
}

// ---------------------------------------------------------------------------
// Mock: auth.Querier
// ---------------------------------------------------------------------------

type MockQueries struct{ mock.Mock }

func (m *MockQueries) GetUserByEmail(ctx context.Context, email string) (store.User, error) {
	args := m.Called(ctx, email)
	return args.Get(0).(store.User), args.Error(1)
}

func (m *MockQueries) GetUserByID(ctx context.Context, id pgtype.UUID) (store.User, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(store.User), args.Error(1)
}

func (m *MockQueries) CreateUser(ctx context.Context, p store.CreateUserParams) (store.CreateUserRow, error) {
	args := m.Called(ctx, p)
	return args.Get(0).(store.CreateUserRow), args.Error(1)
}

func (m *MockQueries) CreateOtp(ctx context.Context, p store.CreateOtpParams) (store.CreateOtpRow, error) {
	args := m.Called(ctx, p)
	return args.Get(0).(store.CreateOtpRow), args.Error(1)
}

func (m *MockQueries) CreateWorkspace(ctx context.Context, userID pgtype.UUID) (store.Workspace, error) {
	args := m.Called(ctx, userID)
	return args.Get(0).(store.Workspace), args.Error(1)
}

func (m *MockQueries) GetValidOtp(ctx context.Context, p store.GetValidOtpParams) (store.Otp, error) {
	args := m.Called(ctx, p)
	return args.Get(0).(store.Otp), args.Error(1)
}

func (m *MockQueries) InvalidateOtpsByType(ctx context.Context, p store.InvalidateOtpsByTypeParams) error {
	return m.Called(ctx, p).Error(0)
}

func (m *MockQueries) UpdateUserVerified(ctx context.Context, p store.UpdateUserVerifiedParams) (store.UpdateUserVerifiedRow, error) {
	args := m.Called(ctx, p)
	return args.Get(0).(store.UpdateUserVerifiedRow), args.Error(1)
}

func (m *MockQueries) ConsumeOtp(ctx context.Context, id pgtype.UUID) (store.ConsumeOtpRow, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(store.ConsumeOtpRow), args.Error(1)
}

func (m *MockQueries) UpdateLastLogin(ctx context.Context, id pgtype.UUID) error {
	return m.Called(ctx, id).Error(0)
}

func (m *MockQueries) UpdateUserPassword(ctx context.Context, p store.UpdateUserPasswordParams) (store.UpdateUserPasswordRow, error) {
	args := m.Called(ctx, p)
	return args.Get(0).(store.UpdateUserPasswordRow), args.Error(1)
}

// ---------------------------------------------------------------------------
// Mock: auth.DBConn
// ---------------------------------------------------------------------------

type MockConn struct{ mock.Mock }

func (m *MockConn) Begin(ctx context.Context) (pgx.Tx, error) {
	args := m.Called(ctx)
	return args.Get(0).(pgx.Tx), args.Error(1)
}

// ---------------------------------------------------------------------------
// Mock: pgx.Tx  (only Commit and Rollback are exercised by handlers)
// ---------------------------------------------------------------------------

type MockTx struct{ mock.Mock }

func (m *MockTx) Begin(ctx context.Context) (pgx.Tx, error)  { return nil, nil }
func (m *MockTx) Commit(ctx context.Context) error            { return m.Called(ctx).Error(0) }
func (m *MockTx) Rollback(ctx context.Context) error          { return m.Called(ctx).Error(0) }
func (m *MockTx) CopyFrom(_ context.Context, _ pgx.Identifier, _ []string, _ pgx.CopyFromSource) (int64, error) {
	return 0, nil
}
func (m *MockTx) SendBatch(_ context.Context, _ *pgx.Batch) pgx.BatchResults { return nil }
func (m *MockTx) LargeObjects() pgx.LargeObjects                             { return pgx.LargeObjects{} }
func (m *MockTx) Prepare(_ context.Context, _, _ string) (*pgconn.StatementDescription, error) {
	return nil, nil
}
func (m *MockTx) Exec(_ context.Context, _ string, _ ...any) (pgconn.CommandTag, error) {
	return pgconn.CommandTag{}, nil
}
func (m *MockTx) Query(_ context.Context, _ string, _ ...any) (pgx.Rows, error) { return nil, nil }
func (m *MockTx) QueryRow(_ context.Context, _ string, _ ...any) pgx.Row        { return nil }
func (m *MockTx) Conn() *pgx.Conn                                                { return nil }

// ---------------------------------------------------------------------------
// Signup
// ---------------------------------------------------------------------------

func TestSignup(t *testing.T) {
	t.Parallel()

	validBody := map[string]string{
		"fullname": "Ada Lovelace",
		"email":    "ada@example.com",
		"password": "S3cur3P@ss!",
	}

	t.Run("201 – creates user and returns success message", func(t *testing.T) {
		q := new(MockQueries)
		uid := mustUUID(t)

		q.On("GetUserByEmail", mock.Anything, validBody["email"]).
			Return(store.User{}, pgx.ErrNoRows)

		newUser := store.CreateUserRow{ID: uid, Email: validBody["email"], Fullname: validBody["fullname"]}
		q.On("CreateUser", mock.Anything, mock.MatchedBy(func(p store.CreateUserParams) bool {
			return p.Email == validBody["email"] && p.Fullname == validBody["fullname"]
		})).Return(newUser, nil)

		q.On("CreateOtp", mock.Anything, mock.MatchedBy(func(p store.CreateOtpParams) bool {
			return p.UserID == uid && p.Type == "email_verification"
		})).Return(store.CreateOtpRow{}, nil)

		q.On("CreateWorkspace", mock.Anything, uid).Return(store.Workspace{}, nil)

		tx := new(MockTx)
		tx.On("Commit", mock.Anything).Return(nil)
		tx.On("Rollback", mock.Anything).Return(nil)

		conn := new(MockConn)
		conn.On("Begin", mock.Anything).Return(tx, nil)

		h := newHandler(q, conn)
		r := newRouter(http.MethodPost, "/auth/signup", h.Signup)
		w := performRequest(r, http.MethodPost, "/auth/signup", validBody)

		assert.Equal(t, http.StatusCreated, w.Code)
		var resp map[string]any
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		assert.True(t, resp["success"].(bool))

		q.AssertExpectations(t)
		tx.AssertExpectations(t)
	})

	t.Run("409 – email already registered (pre-insert check)", func(t *testing.T) {
		q := new(MockQueries)
		q.On("GetUserByEmail", mock.Anything, validBody["email"]).
			Return(store.User{ID: mustUUID(t)}, nil)

		conn := new(MockConn)
		h := newHandler(q, conn)
		r := newRouter(http.MethodPost, "/auth/signup", h.Signup)
		w := performRequest(r, http.MethodPost, "/auth/signup", validBody)

		assert.Equal(t, http.StatusConflict, w.Code)
		q.AssertExpectations(t)
	})

	t.Run("400 – malformed JSON", func(t *testing.T) {
		conn := new(MockConn)
		h := newHandler(new(MockQueries), conn)
		r := newRouter(http.MethodPost, "/auth/signup", h.Signup)

		req := httptest.NewRequest(http.MethodPost, "/auth/signup", bytes.NewBufferString(`{bad json`))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("400 – missing required fields", func(t *testing.T) {
		conn := new(MockConn)
		h := newHandler(new(MockQueries), conn)
		r := newRouter(http.MethodPost, "/auth/signup", h.Signup)
		w := performRequest(r, http.MethodPost, "/auth/signup", map[string]string{"email": "only@email.com"})
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("500 – unexpected DB error on GetUserByEmail", func(t *testing.T) {
		q := new(MockQueries)
		q.On("GetUserByEmail", mock.Anything, validBody["email"]).
			Return(store.User{}, errors.New("db timeout"))

		conn := new(MockConn)
		h := newHandler(q, conn)
		r := newRouter(http.MethodPost, "/auth/signup", h.Signup)
		w := performRequest(r, http.MethodPost, "/auth/signup", validBody)

		assert.Equal(t, http.StatusInternalServerError, w.Code)
	})

	t.Run("500 – Begin transaction failure", func(t *testing.T) {
		q := new(MockQueries)
		q.On("GetUserByEmail", mock.Anything, validBody["email"]).
			Return(store.User{}, pgx.ErrNoRows)

		conn := new(MockConn)
		conn.On("Begin", mock.Anything).Return((*MockTx)(nil), errors.New("connection lost"))

		h := newHandler(q, conn)
		r := newRouter(http.MethodPost, "/auth/signup", h.Signup)
		w := performRequest(r, http.MethodPost, "/auth/signup", validBody)

		assert.Equal(t, http.StatusInternalServerError, w.Code)
	})
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

func TestLogin(t *testing.T) {
	t.Parallel()

	const plainPassword = "V@lid1Pass!"
	uid := mustUUID(t)

	verifiedUser := store.User{
		ID:           uid,
		Email:        "ada@example.com",
		PasswordHash: mustHash(t, plainPassword),
		Verified:     true,
	}

	validBody := map[string]string{
		"email":    verifiedUser.Email,
		"password": plainPassword,
	}

	t.Run("200 – returns token pair on valid credentials", func(t *testing.T) {
		q := new(MockQueries)
		q.On("GetUserByEmail", mock.Anything, verifiedUser.Email).Return(verifiedUser, nil)
		q.On("UpdateLastLogin", mock.Anything, uid).Return(nil)

		conn := new(MockConn)
		h := newHandler(q, conn)
		r := newRouter(http.MethodPost, "/auth/login", h.Login)
		w := performRequest(r, http.MethodPost, "/auth/login", validBody)

		assert.Equal(t, http.StatusOK, w.Code)
		var resp map[string]any
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		data := resp["data"].(map[string]any)
		assert.NotEmpty(t, data["accessToken"])
		assert.NotEmpty(t, data["refreshToken"])

		q.AssertExpectations(t)
	})

	t.Run("404 – unknown email", func(t *testing.T) {
		q := new(MockQueries)
		q.On("GetUserByEmail", mock.Anything, validBody["email"]).Return(store.User{}, pgx.ErrNoRows)

		conn := new(MockConn)
		h := newHandler(q, conn)
		r := newRouter(http.MethodPost, "/auth/login", h.Login)
		w := performRequest(r, http.MethodPost, "/auth/login", validBody)

		assert.Equal(t, http.StatusNotFound, w.Code)
	})

	t.Run("400 – account not verified", func(t *testing.T) {
		unverified := verifiedUser
		unverified.Verified = false

		q := new(MockQueries)
		q.On("GetUserByEmail", mock.Anything, verifiedUser.Email).Return(unverified, nil)

		conn := new(MockConn)
		h := newHandler(q, conn)
		r := newRouter(http.MethodPost, "/auth/login", h.Login)
		w := performRequest(r, http.MethodPost, "/auth/login", validBody)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("400 – wrong password", func(t *testing.T) {
		q := new(MockQueries)
		q.On("GetUserByEmail", mock.Anything, verifiedUser.Email).Return(verifiedUser, nil)

		conn := new(MockConn)
		h := newHandler(q, conn)
		r := newRouter(http.MethodPost, "/auth/login", h.Login)
		w := performRequest(r, http.MethodPost, "/auth/login", map[string]string{
			"email":    verifiedUser.Email,
			"password": "wr0ngPassword!",
		})

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("400 – missing body fields", func(t *testing.T) {
		conn := new(MockConn)
		h := newHandler(new(MockQueries), conn)
		r := newRouter(http.MethodPost, "/auth/login", h.Login)
		w := performRequest(r, http.MethodPost, "/auth/login", map[string]string{"email": "only@email.com"})
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}

// ---------------------------------------------------------------------------
// VerifyOtp
// ---------------------------------------------------------------------------

func TestVerifyOtp(t *testing.T) {
	t.Parallel()

	uid := mustUUID(t)
	otpID := mustUUID2(t)
	validUser := store.User{ID: uid, Email: "ada@example.com"}

	const testOtp = "123456"
	otpHash := mustHash(t, testOtp)

	validBody := map[string]string{
		"email": validUser.Email,
		"otp":   testOtp,
	}

	activeOtp := store.Otp{
		ID:        otpID,
		UserID:    uid,
		Type:      "email_verification",
		OtpHash:   otpHash,
		ExpiresAt: futureTimestamp(5 * time.Minute),
	}

	t.Run("200 – verifies email successfully", func(t *testing.T) {
		q := new(MockQueries)
		q.On("GetUserByEmail", mock.Anything, validUser.Email).Return(validUser, nil)
		q.On("GetValidOtp", mock.Anything, store.GetValidOtpParams{UserID: uid, Type: "email_verification"}).
			Return(activeOtp, nil)
		q.On("UpdateUserVerified", mock.Anything, store.UpdateUserVerifiedParams{ID: uid, Verified: true}).
			Return(store.UpdateUserVerifiedRow{}, nil)
		q.On("ConsumeOtp", mock.Anything, otpID).Return(store.ConsumeOtpRow{}, nil)

		conn := new(MockConn)
		h := newHandler(q, conn)
		r := newRouter(http.MethodPost, "/auth/verify-otp", h.VerifyOtp)
		w := performRequest(r, http.MethodPost, "/auth/verify-otp", validBody)

		assert.Equal(t, http.StatusOK, w.Code)
		q.AssertExpectations(t)
	})

	t.Run("400 – wrong OTP code", func(t *testing.T) {
		q := new(MockQueries)
		q.On("GetUserByEmail", mock.Anything, validUser.Email).Return(validUser, nil)
		q.On("GetValidOtp", mock.Anything, mock.Anything).Return(activeOtp, nil)

		conn := new(MockConn)
		h := newHandler(q, conn)
		r := newRouter(http.MethodPost, "/auth/verify-otp", h.VerifyOtp)
		w := performRequest(r, http.MethodPost, "/auth/verify-otp", map[string]string{
			"email": validUser.Email,
			"otp":   "000000",
		})

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("404 – user not found", func(t *testing.T) {
		q := new(MockQueries)
		q.On("GetUserByEmail", mock.Anything, validUser.Email).Return(store.User{}, pgx.ErrNoRows)

		conn := new(MockConn)
		h := newHandler(q, conn)
		r := newRouter(http.MethodPost, "/auth/verify-otp", h.VerifyOtp)
		w := performRequest(r, http.MethodPost, "/auth/verify-otp", validBody)

		assert.Equal(t, http.StatusNotFound, w.Code)
	})

	t.Run("404 – no valid OTP on record (consumed or expired)", func(t *testing.T) {
		q := new(MockQueries)
		q.On("GetUserByEmail", mock.Anything, validUser.Email).Return(validUser, nil)
		q.On("GetValidOtp", mock.Anything, mock.Anything).Return(store.Otp{}, pgx.ErrNoRows)

		conn := new(MockConn)
		h := newHandler(q, conn)
		r := newRouter(http.MethodPost, "/auth/verify-otp", h.VerifyOtp)
		w := performRequest(r, http.MethodPost, "/auth/verify-otp", validBody)

		assert.Equal(t, http.StatusNotFound, w.Code)
	})
}

// ---------------------------------------------------------------------------
// RequestOtp
// ---------------------------------------------------------------------------

func TestRequestOtp(t *testing.T) {
	t.Parallel()

	uid := mustUUID(t)
	existingUser := store.User{ID: uid, Email: "ada@example.com"}
	validBody := map[string]string{"email": existingUser.Email}

	t.Run("200 – issues new OTP", func(t *testing.T) {
		q := new(MockQueries)
		q.On("GetUserByEmail", mock.Anything, existingUser.Email).Return(existingUser, nil)
		q.On("InvalidateOtpsByType", mock.Anything, store.InvalidateOtpsByTypeParams{
			UserID: uid, Type: "email_verification",
		}).Return(nil)
		q.On("CreateOtp", mock.Anything, mock.MatchedBy(func(p store.CreateOtpParams) bool {
			return p.UserID == uid && p.Type == "email_verification"
		})).Return(store.CreateOtpRow{}, nil)

		conn := new(MockConn)
		h := newHandler(q, conn)
		r := newRouter(http.MethodPost, "/auth/request-otp", h.RequestOtp)
		w := performRequest(r, http.MethodPost, "/auth/request-otp", validBody)

		assert.Equal(t, http.StatusOK, w.Code)
		q.AssertExpectations(t)
	})

	t.Run("404 – email not registered", func(t *testing.T) {
		q := new(MockQueries)
		q.On("GetUserByEmail", mock.Anything, existingUser.Email).Return(store.User{}, pgx.ErrNoRows)

		conn := new(MockConn)
		h := newHandler(q, conn)
		r := newRouter(http.MethodPost, "/auth/request-otp", h.RequestOtp)
		w := performRequest(r, http.MethodPost, "/auth/request-otp", validBody)

		assert.Equal(t, http.StatusNotFound, w.Code)
	})

	t.Run("500 – InvalidateOtpsByType fails", func(t *testing.T) {
		q := new(MockQueries)
		q.On("GetUserByEmail", mock.Anything, existingUser.Email).Return(existingUser, nil)
		q.On("InvalidateOtpsByType", mock.Anything, mock.Anything).Return(errors.New("db error"))

		conn := new(MockConn)
		h := newHandler(q, conn)
		r := newRouter(http.MethodPost, "/auth/request-otp", h.RequestOtp)
		w := performRequest(r, http.MethodPost, "/auth/request-otp", validBody)

		assert.Equal(t, http.StatusInternalServerError, w.Code)
	})
}

// ---------------------------------------------------------------------------
// RequestPasswordReset
// ---------------------------------------------------------------------------

func TestRequestPasswordReset(t *testing.T) {
	t.Parallel()

	uid := mustUUID(t)
	existingUser := store.User{ID: uid, Email: "ada@example.com"}
	validBody := map[string]string{"email": existingUser.Email}

	t.Run("200 – sends reset OTP", func(t *testing.T) {
		q := new(MockQueries)
		q.On("GetUserByEmail", mock.Anything, existingUser.Email).Return(existingUser, nil)
		q.On("InvalidateOtpsByType", mock.Anything, store.InvalidateOtpsByTypeParams{
			UserID: uid, Type: "password_reset",
		}).Return(nil)
		q.On("CreateOtp", mock.Anything, mock.MatchedBy(func(p store.CreateOtpParams) bool {
			return p.UserID == uid && p.Type == "password_reset"
		})).Return(store.CreateOtpRow{}, nil)

		conn := new(MockConn)
		h := newHandler(q, conn)
		r := newRouter(http.MethodPost, "/auth/request-password-reset", h.RequestPasswordReset)
		w := performRequest(r, http.MethodPost, "/auth/request-password-reset", validBody)

		assert.Equal(t, http.StatusOK, w.Code)
		q.AssertExpectations(t)
	})

	t.Run("404 – unknown email", func(t *testing.T) {
		q := new(MockQueries)
		q.On("GetUserByEmail", mock.Anything, existingUser.Email).Return(store.User{}, pgx.ErrNoRows)

		conn := new(MockConn)
		h := newHandler(q, conn)
		r := newRouter(http.MethodPost, "/auth/request-password-reset", h.RequestPasswordReset)
		w := performRequest(r, http.MethodPost, "/auth/request-password-reset", validBody)

		assert.Equal(t, http.StatusNotFound, w.Code)
	})
}

// ---------------------------------------------------------------------------
// ResetPassword
// ---------------------------------------------------------------------------

func TestResetPassword(t *testing.T) {
	t.Parallel()

	uid := mustUUID(t)
	otpID := mustUUID2(t)
	existingUser := store.User{ID: uid, Email: "ada@example.com"}

	const testOtp = "654321"
	otpHash := mustHash(t, testOtp)

	validBody := map[string]string{
		"email":           existingUser.Email,
		"otp":             testOtp,
		"password":        "N3wS3cur3P@ss!",
		"confirmPassword": "N3wS3cur3P@ss!",
	}

	activeOtp := store.Otp{
		ID:        otpID,
		UserID:    uid,
		Type:      "password_reset",
		OtpHash:   otpHash,
		ExpiresAt: futureTimestamp(5 * time.Minute),
	}

	t.Run("200 – password updated and OTP consumed", func(t *testing.T) {
		q := new(MockQueries)
		q.On("GetUserByEmail", mock.Anything, existingUser.Email).Return(existingUser, nil)
		q.On("GetValidOtp", mock.Anything, store.GetValidOtpParams{UserID: uid, Type: "password_reset"}).
			Return(activeOtp, nil)
		q.On("UpdateUserPassword", mock.Anything, mock.MatchedBy(func(p store.UpdateUserPasswordParams) bool {
			return p.ID == uid && p.PasswordHash != ""
		})).Return(store.UpdateUserPasswordRow{}, nil)
		q.On("ConsumeOtp", mock.Anything, otpID).Return(store.ConsumeOtpRow{}, nil)

		conn := new(MockConn)
		h := newHandler(q, conn)
		r := newRouter(http.MethodPost, "/auth/reset-password", h.ResetPassword)
		w := performRequest(r, http.MethodPost, "/auth/reset-password", validBody)

		assert.Equal(t, http.StatusOK, w.Code)
		q.AssertExpectations(t)
	})

	t.Run("400 – wrong OTP code", func(t *testing.T) {
		q := new(MockQueries)
		q.On("GetUserByEmail", mock.Anything, existingUser.Email).Return(existingUser, nil)
		q.On("GetValidOtp", mock.Anything, mock.Anything).Return(activeOtp, nil)

		conn := new(MockConn)
		h := newHandler(q, conn)
		r := newRouter(http.MethodPost, "/auth/reset-password", h.ResetPassword)
		w := performRequest(r, http.MethodPost, "/auth/reset-password", map[string]string{
			"email":           existingUser.Email,
			"otp":             "000000",
			"password":        "N3wS3cur3P@ss!",
			"confirmPassword": "N3wS3cur3P@ss!",
		})

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("400 – password mismatch", func(t *testing.T) {
		conn := new(MockConn)
		h := newHandler(new(MockQueries), conn)
		r := newRouter(http.MethodPost, "/auth/reset-password", h.ResetPassword)
		w := performRequest(r, http.MethodPost, "/auth/reset-password", map[string]string{
			"email":           existingUser.Email,
			"otp":             testOtp,
			"password":        "N3wS3cur3P@ss!",
			"confirmPassword": "D1fferentP@ss!",
		})

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("404 – user not found", func(t *testing.T) {
		q := new(MockQueries)
		q.On("GetUserByEmail", mock.Anything, existingUser.Email).Return(store.User{}, pgx.ErrNoRows)

		conn := new(MockConn)
		h := newHandler(q, conn)
		r := newRouter(http.MethodPost, "/auth/reset-password", h.ResetPassword)
		w := performRequest(r, http.MethodPost, "/auth/reset-password", validBody)

		assert.Equal(t, http.StatusNotFound, w.Code)
	})

	t.Run("404 – no valid OTP on record", func(t *testing.T) {
		q := new(MockQueries)
		q.On("GetUserByEmail", mock.Anything, existingUser.Email).Return(existingUser, nil)
		q.On("GetValidOtp", mock.Anything, mock.Anything).Return(store.Otp{}, pgx.ErrNoRows)

		conn := new(MockConn)
		h := newHandler(q, conn)
		r := newRouter(http.MethodPost, "/auth/reset-password", h.ResetPassword)
		w := performRequest(r, http.MethodPost, "/auth/reset-password", validBody)

		assert.Equal(t, http.StatusNotFound, w.Code)
	})
}

// ---------------------------------------------------------------------------
// RefreshToken
// ---------------------------------------------------------------------------

func TestRefreshToken(t *testing.T) {
	t.Parallel()

	uid := mustUUID(t)
	existingUser := store.User{ID: uid, Email: "ada@example.com", Verified: true}

	injectSub := func(c *gin.Context) {
		c.Set("sub", uid)
		c.Next()
	}

	t.Run("200 – returns new token pair", func(t *testing.T) {
		q := new(MockQueries)
		q.On("GetUserByID", mock.Anything, uid).Return(existingUser, nil)

		conn := new(MockConn)
		h := newHandler(q, conn)
		r := newRouter(http.MethodPost, "/auth/refresh", h.RefreshToken, injectSub)
		w := performRequest(r, http.MethodPost, "/auth/refresh", map[string]string{"refreshToken": "tok"})

		assert.Equal(t, http.StatusOK, w.Code)
		var resp map[string]any
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		data := resp["data"].(map[string]any)
		assert.NotEmpty(t, data["accessToken"])
		assert.NotEmpty(t, data["refreshToken"])

		q.AssertExpectations(t)
	})

	t.Run("404 – user deleted between token issue and refresh", func(t *testing.T) {
		q := new(MockQueries)
		q.On("GetUserByID", mock.Anything, uid).Return(store.User{}, pgx.ErrNoRows)

		conn := new(MockConn)
		h := newHandler(q, conn)
		r := newRouter(http.MethodPost, "/auth/refresh", h.RefreshToken, injectSub)
		w := performRequest(r, http.MethodPost, "/auth/refresh", map[string]string{"refreshToken": "tok"})

		assert.Equal(t, http.StatusNotFound, w.Code)
	})

	t.Run("400 – missing refresh token body", func(t *testing.T) {
		conn := new(MockConn)
		h := newHandler(new(MockQueries), conn)
		r := newRouter(http.MethodPost, "/auth/refresh", h.RefreshToken, injectSub)
		w := performRequest(r, http.MethodPost, "/auth/refresh", map[string]string{})
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}
