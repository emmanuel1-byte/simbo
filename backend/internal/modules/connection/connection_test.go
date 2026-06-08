package connection_test

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
	"simbo-api-service/internal/modules/connection"
)

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

func init() {
	gin.SetMode(gin.TestMode)
}

func mustUUID(t *testing.T, s string) pgtype.UUID {
	t.Helper()
	var id pgtype.UUID
	require.NoError(t, id.Scan(s))
	return id
}

func userUUID(t *testing.T) pgtype.UUID {
	return mustUUID(t, "550e8400-e29b-41d4-a716-446655440000")
}

func workspaceUUID(t *testing.T) pgtype.UUID {
	return mustUUID(t, "660e8400-e29b-41d4-a716-446655440001")
}

func connUUID(t *testing.T) pgtype.UUID {
	return mustUUID(t, "770e8400-e29b-41d4-a716-446655440002")
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

func injectSub(uid pgtype.UUID) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set("sub", uid)
		c.Next()
	}
}

func newHandler(q *MockQueries, tester *MockTester) *connection.Handler {
	return connection.NewHandler(q, connection.PlaintextEncryptor{}, tester)
}

// ---------------------------------------------------------------------------
// Mock: connection.Querier
// ---------------------------------------------------------------------------

type MockQueries struct{ mock.Mock }

func (m *MockQueries) GetWorkspaceByUserID(ctx context.Context, userID pgtype.UUID) (store.Workspace, error) {
	args := m.Called(ctx, userID)
	return args.Get(0).(store.Workspace), args.Error(1)
}

func (m *MockQueries) CreateConnection(ctx context.Context, p store.CreateConnectionParams) (store.CreateConnectionRow, error) {
	args := m.Called(ctx, p)
	return args.Get(0).(store.CreateConnectionRow), args.Error(1)
}

func (m *MockQueries) GetConnectionByID(ctx context.Context, p store.GetConnectionByIDParams) (store.Connection, error) {
	args := m.Called(ctx, p)
	return args.Get(0).(store.Connection), args.Error(1)
}

func (m *MockQueries) ListConnections(ctx context.Context, userID pgtype.UUID) ([]store.ListConnectionsRow, error) {
	args := m.Called(ctx, userID)
	return args.Get(0).([]store.ListConnectionsRow), args.Error(1)
}

func (m *MockQueries) UpdateConnectionStatus(ctx context.Context, p store.UpdateConnectionStatusParams) (store.UpdateConnectionStatusRow, error) {
	args := m.Called(ctx, p)
	return args.Get(0).(store.UpdateConnectionStatusRow), args.Error(1)
}

func (m *MockQueries) UpdateConnectionSync(ctx context.Context, p store.UpdateConnectionSyncParams) error {
	return m.Called(ctx, p).Error(0)
}

func (m *MockQueries) DeleteConnection(ctx context.Context, p store.DeleteConnectionParams) error {
	return m.Called(ctx, p).Error(0)
}

// ---------------------------------------------------------------------------
// Mock: connection.Tester
// ---------------------------------------------------------------------------

type MockTester struct{ mock.Mock }

func (m *MockTester) Test(ctx context.Context, p connection.TestParams) (int32, error) {
	args := m.Called(ctx, p)
	return args.Get(0).(int32), args.Error(1)
}

// ---------------------------------------------------------------------------
// AddConnection
// ---------------------------------------------------------------------------

func TestAddConnection(t *testing.T) {
	t.Parallel()

	uid := userUUID(t)
	wsID := workspaceUUID(t)

	validBody := map[string]any{
		"name":          "production · postgres",
		"db_type":       "postgres",
		"host":          "db.acme.internal",
		"port":          5432,
		"database_name": "acme_prod",
		"username":      "readonly_user",
		"password":      "s3cret",
		"use_tls":       true,
	}

	t.Run("201 – saves connection and returns it without password", func(t *testing.T) {
		q := new(MockQueries)
		workspace := store.Workspace{ID: wsID, UserID: uid}
		q.On("GetWorkspaceByUserID", mock.Anything, uid).Return(workspace, nil)

		created := store.CreateConnectionRow{
			ID:           connUUID(t),
			WorkspaceID:  wsID,
			UserID:       uid,
			Name:         "production · postgres",
			DbType:       "postgres",
			Host:         "db.acme.internal",
			Port:         5432,
			DatabaseName: "acme_prod",
			Username:     "readonly_user",
			UseTls:       true,
			Status:       "pending",
		}
		q.On("CreateConnection", mock.Anything, mock.MatchedBy(func(p store.CreateConnectionParams) bool {
			return p.UserID == uid &&
				p.WorkspaceID == wsID &&
				p.Name == "production · postgres" &&
				p.DbType == "postgres" &&
				p.PasswordEncrypted != "" // encrypted by PlaintextEncryptor = plaintext
		})).Return(created, nil)

		h := newHandler(q, new(MockTester))
		r := newRouter(http.MethodPost, "/connections", h.AddConnection, injectSub(uid))
		w := performRequest(r, http.MethodPost, "/connections", validBody)

		assert.Equal(t, http.StatusCreated, w.Code)
		var resp map[string]any
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		assert.True(t, resp["success"].(bool))

		data := resp["data"].(map[string]any)
		assert.Equal(t, "production · postgres", data["name"])
		assert.NotContains(t, data, "password_encrypted")

		q.AssertExpectations(t)
	})

	t.Run("400 – invalid db_type", func(t *testing.T) {
		h := newHandler(new(MockQueries), new(MockTester))
		r := newRouter(http.MethodPost, "/connections", h.AddConnection, injectSub(uid))
		w := performRequest(r, http.MethodPost, "/connections", map[string]any{
			"name": "bad", "db_type": "oracle", "host": "h", "port": 5432,
			"database_name": "d", "username": "u", "password": "p",
		})
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("400 – missing required fields", func(t *testing.T) {
		h := newHandler(new(MockQueries), new(MockTester))
		r := newRouter(http.MethodPost, "/connections", h.AddConnection, injectSub(uid))
		w := performRequest(r, http.MethodPost, "/connections", map[string]any{"name": "only-name"})
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("500 – workspace not found", func(t *testing.T) {
		q := new(MockQueries)
		q.On("GetWorkspaceByUserID", mock.Anything, uid).Return(store.Workspace{}, pgx.ErrNoRows)

		h := newHandler(q, new(MockTester))
		r := newRouter(http.MethodPost, "/connections", h.AddConnection, injectSub(uid))
		w := performRequest(r, http.MethodPost, "/connections", validBody)
		assert.Equal(t, http.StatusInternalServerError, w.Code)
	})
}

// ---------------------------------------------------------------------------
// ListConnections
// ---------------------------------------------------------------------------

func TestListConnections(t *testing.T) {
	t.Parallel()

	uid := userUUID(t)

	t.Run("200 – returns list of connections", func(t *testing.T) {
		q := new(MockQueries)
		rows := []store.ListConnectionsRow{
			{ID: connUUID(t), Name: "prod", DbType: "postgres", Host: "db.example.com", Port: 5432, Status: "connected"},
		}
		q.On("ListConnections", mock.Anything, uid).Return(rows, nil)

		h := newHandler(q, new(MockTester))
		r := newRouter(http.MethodGet, "/connections", h.ListConnections, injectSub(uid))
		w := performRequest(r, http.MethodGet, "/connections", nil)

		assert.Equal(t, http.StatusOK, w.Code)
		var resp map[string]any
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		data := resp["data"].([]any)
		assert.Len(t, data, 1)
		q.AssertExpectations(t)
	})

	t.Run("200 – returns empty list when no connections", func(t *testing.T) {
		q := new(MockQueries)
		q.On("ListConnections", mock.Anything, uid).Return([]store.ListConnectionsRow{}, nil)

		h := newHandler(q, new(MockTester))
		r := newRouter(http.MethodGet, "/connections", h.ListConnections, injectSub(uid))
		w := performRequest(r, http.MethodGet, "/connections", nil)

		assert.Equal(t, http.StatusOK, w.Code)
		var resp map[string]any
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		data := resp["data"].([]any)
		assert.Empty(t, data)
	})

	t.Run("500 – DB error", func(t *testing.T) {
		q := new(MockQueries)
		q.On("ListConnections", mock.Anything, uid).Return([]store.ListConnectionsRow{}, errors.New("db error"))

		h := newHandler(q, new(MockTester))
		r := newRouter(http.MethodGet, "/connections", h.ListConnections, injectSub(uid))
		w := performRequest(r, http.MethodGet, "/connections", nil)

		assert.Equal(t, http.StatusInternalServerError, w.Code)
	})
}

// ---------------------------------------------------------------------------
// ProbeConnection
// ---------------------------------------------------------------------------

func TestProbeConnection(t *testing.T) {
	t.Parallel()

	uid := userUUID(t)
	validBody := map[string]any{
		"db_type": "postgres", "host": "db.acme.internal", "port": 5432,
		"database_name": "acme_prod", "username": "user", "password": "pass",
		"use_tls": true,
	}

	t.Run("200 – connection successful", func(t *testing.T) {
		tester := new(MockTester)
		tester.On("Test", mock.Anything, mock.MatchedBy(func(p connection.TestParams) bool {
			return p.DBType == "postgres" && p.Host == "db.acme.internal"
		})).Return(int32(14), nil)

		h := newHandler(new(MockQueries), tester)
		r := newRouter(http.MethodPost, "/connections/probe", h.ProbeConnection, injectSub(uid))
		w := performRequest(r, http.MethodPost, "/connections/probe", validBody)

		assert.Equal(t, http.StatusOK, w.Code)
		var resp map[string]any
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		data := resp["data"].(map[string]any)
		assert.Equal(t, float64(14), data["tableCount"])
		tester.AssertExpectations(t)
	})

	t.Run("400 – connection refused", func(t *testing.T) {
		tester := new(MockTester)
		tester.On("Test", mock.Anything, mock.Anything).Return(int32(0), errors.New("connection refused"))

		h := newHandler(new(MockQueries), tester)
		r := newRouter(http.MethodPost, "/connections/probe", h.ProbeConnection, injectSub(uid))
		w := performRequest(r, http.MethodPost, "/connections/probe", validBody)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("400 – invalid body", func(t *testing.T) {
		h := newHandler(new(MockQueries), new(MockTester))
		r := newRouter(http.MethodPost, "/connections/probe", h.ProbeConnection, injectSub(uid))
		w := performRequest(r, http.MethodPost, "/connections/probe", map[string]any{"db_type": "postgres"})
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}

// ---------------------------------------------------------------------------
// TestConnection
// ---------------------------------------------------------------------------

func TestTestConnection(t *testing.T) {
	t.Parallel()

	uid := userUUID(t)
	cid := connUUID(t)
	connIDStr := "770e8400-e29b-41d4-a716-446655440002"

	existing := store.Connection{
		ID:                cid,
		UserID:            uid,
		DbType:            "postgres",
		Host:              "db.acme.internal",
		Port:              5432,
		DatabaseName:      "acme_prod",
		Username:          "user",
		PasswordEncrypted: "s3cret",
		UseTls:            true,
	}

	t.Run("200 – connected, updates status and table count", func(t *testing.T) {
		q := new(MockQueries)
		q.On("GetConnectionByID", mock.Anything, store.GetConnectionByIDParams{ID: cid, UserID: uid}).
			Return(existing, nil)
		q.On("UpdateConnectionStatus", mock.Anything, mock.MatchedBy(func(p store.UpdateConnectionStatusParams) bool {
			return p.ID == cid && p.Status == "connected" && !p.LastError.Valid
		})).Return(store.UpdateConnectionStatusRow{ID: cid, Status: "connected"}, nil)
		q.On("UpdateConnectionSync", mock.Anything, mock.MatchedBy(func(p store.UpdateConnectionSyncParams) bool {
			return p.ID == cid && p.TableCount == 14
		})).Return(nil)

		tester := new(MockTester)
		tester.On("Test", mock.Anything, mock.MatchedBy(func(p connection.TestParams) bool {
			return p.Password == "s3cret" && p.Host == "db.acme.internal"
		})).Return(int32(14), nil)

		h := newHandler(q, tester)
		r := newRouter(http.MethodPost, "/connections/:id/test", h.TestConnection, injectSub(uid))
		w := performRequest(r, http.MethodPost, "/connections/"+connIDStr+"/test", nil)

		assert.Equal(t, http.StatusOK, w.Code)
		var resp map[string]any
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		data := resp["data"].(map[string]any)
		assert.Equal(t, "connected", data["status"])
		assert.Nil(t, data["error"])

		q.AssertExpectations(t)
		tester.AssertExpectations(t)
	})

	t.Run("200 – connection failed, saves error status", func(t *testing.T) {
		q := new(MockQueries)
		q.On("GetConnectionByID", mock.Anything, mock.Anything).Return(existing, nil)
		q.On("UpdateConnectionStatus", mock.Anything, mock.MatchedBy(func(p store.UpdateConnectionStatusParams) bool {
			return p.Status == "error" && p.LastError.Valid
		})).Return(store.UpdateConnectionStatusRow{
			ID:        cid,
			Status:    "error",
			LastError: pgtype.Text{String: "connection refused", Valid: true},
		}, nil)

		tester := new(MockTester)
		tester.On("Test", mock.Anything, mock.Anything).Return(int32(0), errors.New("connection refused"))

		h := newHandler(q, tester)
		r := newRouter(http.MethodPost, "/connections/:id/test", h.TestConnection, injectSub(uid))
		w := performRequest(r, http.MethodPost, "/connections/"+connIDStr+"/test", nil)

		assert.Equal(t, http.StatusOK, w.Code)
		var resp map[string]any
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		data := resp["data"].(map[string]any)
		assert.Equal(t, "error", data["status"])
		assert.NotNil(t, data["error"])

		q.AssertExpectations(t)
	})

	t.Run("400 – invalid UUID in path", func(t *testing.T) {
		h := newHandler(new(MockQueries), new(MockTester))
		r := newRouter(http.MethodPost, "/connections/:id/test", h.TestConnection, injectSub(uid))
		w := performRequest(r, http.MethodPost, "/connections/not-a-uuid/test", nil)
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("404 – connection belongs to different user", func(t *testing.T) {
		q := new(MockQueries)
		q.On("GetConnectionByID", mock.Anything, mock.Anything).Return(store.Connection{}, pgx.ErrNoRows)

		h := newHandler(q, new(MockTester))
		r := newRouter(http.MethodPost, "/connections/:id/test", h.TestConnection, injectSub(uid))
		w := performRequest(r, http.MethodPost, "/connections/"+connIDStr+"/test", nil)

		assert.Equal(t, http.StatusNotFound, w.Code)
	})
}

// ---------------------------------------------------------------------------
// RemoveConnection
// ---------------------------------------------------------------------------

func TestRemoveConnection(t *testing.T) {
	t.Parallel()

	uid := userUUID(t)
	cid := connUUID(t)
	connIDStr := "770e8400-e29b-41d4-a716-446655440002"

	t.Run("200 – deletes connection", func(t *testing.T) {
		q := new(MockQueries)
		q.On("DeleteConnection", mock.Anything, store.DeleteConnectionParams{ID: cid, UserID: uid}).Return(nil)

		h := newHandler(q, new(MockTester))
		r := newRouter(http.MethodDelete, "/connections/:id", h.RemoveConnection, injectSub(uid))
		w := performRequest(r, http.MethodDelete, "/connections/"+connIDStr, nil)

		assert.Equal(t, http.StatusOK, w.Code)
		q.AssertExpectations(t)
	})

	t.Run("400 – invalid UUID", func(t *testing.T) {
		h := newHandler(new(MockQueries), new(MockTester))
		r := newRouter(http.MethodDelete, "/connections/:id", h.RemoveConnection, injectSub(uid))
		w := performRequest(r, http.MethodDelete, "/connections/bad-id", nil)
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("500 – DB error on delete", func(t *testing.T) {
		q := new(MockQueries)
		q.On("DeleteConnection", mock.Anything, mock.Anything).Return(errors.New("db error"))

		h := newHandler(q, new(MockTester))
		r := newRouter(http.MethodDelete, "/connections/:id", h.RemoveConnection, injectSub(uid))
		w := performRequest(r, http.MethodDelete, "/connections/"+connIDStr, nil)
		assert.Equal(t, http.StatusInternalServerError, w.Code)
	})
}
