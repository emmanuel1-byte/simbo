package profile_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"simbo-api-service/internal/database/store"
	"simbo-api-service/internal/modules/profile"
)

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

func init() {
	gin.SetMode(gin.TestMode)
}

func mustUUID(t *testing.T) pgtype.UUID {
	t.Helper()
	var id pgtype.UUID
	require.NoError(t, id.Scan("550e8400-e29b-41d4-a716-446655440000"))
	return id
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

// injectSub simulates the JWT middleware injecting a user ID into the context.
func injectSub(uid pgtype.UUID) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set("sub", uid)
		c.Next()
	}
}

// ---------------------------------------------------------------------------
// Mock: profile.Querier
// ---------------------------------------------------------------------------

type MockQueries struct{ mock.Mock }

func (m *MockQueries) GetUserByID(ctx context.Context, id pgtype.UUID) (store.User, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(store.User), args.Error(1)
}

func (m *MockQueries) UpdateUserProfile(ctx context.Context, p store.UpdateUserProfileParams) (store.UpdateUserProfileRow, error) {
	args := m.Called(ctx, p)
	return args.Get(0).(store.UpdateUserProfileRow), args.Error(1)
}

// ---------------------------------------------------------------------------
// GetProfile
// ---------------------------------------------------------------------------

func TestGetProfile(t *testing.T) {
	t.Parallel()

	uid := mustUUID(t)
	user := store.User{
		ID:       uid,
		Fullname: "Ada Lovelace",
		Email:    "ada@example.com",
	}

	t.Run("200 – returns profile fields", func(t *testing.T) {
		q := new(MockQueries)
		q.On("GetUserByID", mock.Anything, uid).Return(user, nil)

		h := profile.NewHandler(q)
		r := newRouter(http.MethodGet, "/profile", h.GetProfile, injectSub(uid))
		w := performRequest(r, http.MethodGet, "/profile", nil)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp map[string]any
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		assert.True(t, resp["success"].(bool))
		data := resp["data"].(map[string]any)
		assert.Equal(t, user.Fullname, data["fullname"])
		assert.Equal(t, user.Email, data["email"])

		q.AssertExpectations(t)
	})

	t.Run("404 – user not found", func(t *testing.T) {
		q := new(MockQueries)
		q.On("GetUserByID", mock.Anything, uid).Return(store.User{}, pgx.ErrNoRows)

		h := profile.NewHandler(q)
		r := newRouter(http.MethodGet, "/profile", h.GetProfile, injectSub(uid))
		w := performRequest(r, http.MethodGet, "/profile", nil)

		assert.Equal(t, http.StatusNotFound, w.Code)
		q.AssertExpectations(t)
	})
}

// ---------------------------------------------------------------------------
// UpdateProfile
// ---------------------------------------------------------------------------

func TestUpdateProfile(t *testing.T) {
	t.Parallel()

	uid := mustUUID(t)
	existingUser := store.User{
		ID:       uid,
		Fullname: "Ada Lovelace",
		Email:    "ada@example.com",
	}

	validBody := map[string]string{
		"fullname": "Ada King",
		"email":    "ada.king@example.com",
	}

	updatedRow := store.UpdateUserProfileRow{
		ID:       uid,
		Fullname: validBody["fullname"],
		Email:    validBody["email"],
	}

	t.Run("200 – returns updated profile", func(t *testing.T) {
		q := new(MockQueries)
		q.On("GetUserByID", mock.Anything, uid).Return(existingUser, nil)
		q.On("UpdateUserProfile", mock.Anything, store.UpdateUserProfileParams{
			ID:       uid,
			Fullname: validBody["fullname"],
			Email:    validBody["email"],
		}).Return(updatedRow, nil)

		h := profile.NewHandler(q)
		r := newRouter(http.MethodPut, "/profile", h.UpdateProfile, injectSub(uid))
		w := performRequest(r, http.MethodPut, "/profile", validBody)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp map[string]any
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		data := resp["data"].(map[string]any)
		assert.Equal(t, updatedRow.Fullname, data["fullname"])
		assert.Equal(t, updatedRow.Email, data["email"])

		q.AssertExpectations(t)
	})

	t.Run("400 – missing required fields", func(t *testing.T) {
		h := profile.NewHandler(new(MockQueries))
		r := newRouter(http.MethodPut, "/profile", h.UpdateProfile, injectSub(uid))
		w := performRequest(r, http.MethodPut, "/profile", map[string]string{"fullname": "Ada"})

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("400 – invalid email format", func(t *testing.T) {
		h := profile.NewHandler(new(MockQueries))
		r := newRouter(http.MethodPut, "/profile", h.UpdateProfile, injectSub(uid))
		w := performRequest(r, http.MethodPut, "/profile", map[string]string{
			"fullname": "Ada King",
			"email":    "not-an-email",
		})

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("404 – user not found", func(t *testing.T) {
		q := new(MockQueries)
		q.On("GetUserByID", mock.Anything, uid).Return(store.User{}, pgx.ErrNoRows)

		h := profile.NewHandler(q)
		r := newRouter(http.MethodPut, "/profile", h.UpdateProfile, injectSub(uid))
		w := performRequest(r, http.MethodPut, "/profile", validBody)

		assert.Equal(t, http.StatusNotFound, w.Code)
		q.AssertExpectations(t)
	})

	t.Run("500 – DB error on UpdateUserProfile", func(t *testing.T) {
		q := new(MockQueries)
		q.On("GetUserByID", mock.Anything, uid).Return(existingUser, nil)
		q.On("UpdateUserProfile", mock.Anything, mock.Anything).
			Return(store.UpdateUserProfileRow{}, errors.New("db timeout"))

		h := profile.NewHandler(q)
		r := newRouter(http.MethodPut, "/profile", h.UpdateProfile, injectSub(uid))
		w := performRequest(r, http.MethodPut, "/profile", validBody)

		assert.Equal(t, http.StatusInternalServerError, w.Code)
		q.AssertExpectations(t)
	})
}
