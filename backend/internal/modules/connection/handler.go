package connection

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"simbo-api-service/internal/database/store"
	"simbo-api-service/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgtype"
)

// Querier is the database interface required by the connection handlers.
// It is satisfied by *store.Queries and can be mocked in tests.
type Querier interface {
	GetWorkspaceByUserID(ctx context.Context, userID pgtype.UUID) (store.Workspace, error)
	CreateConnection(ctx context.Context, p store.CreateConnectionParams) (store.CreateConnectionRow, error)
	GetConnectionByID(ctx context.Context, p store.GetConnectionByIDParams) (store.Connection, error)
	ListConnections(ctx context.Context, userID pgtype.UUID) ([]store.ListConnectionsRow, error)
	UpdateConnectionStatus(ctx context.Context, p store.UpdateConnectionStatusParams) (store.UpdateConnectionStatusRow, error)
	UpdateConnectionSync(ctx context.Context, p store.UpdateConnectionSyncParams) error
	DeleteConnection(ctx context.Context, p store.DeleteConnectionParams) error
}

// Handler holds the connection handler dependencies.
type Handler struct {
	q      Querier
	enc    Encryptor
	tester Tester
}

// NewHandler constructs a Handler.
// In production: enc = AESEncryptor{}, tester = LiveTester{}.
func NewHandler(q Querier, enc Encryptor, tester Tester) *Handler {
	return &Handler{q: q, enc: enc, tester: tester}
}

// AddConnection saves a new database connection for the authenticated user.
func (h *Handler) AddConnection(c *gin.Context) {
	var body AddConnectionSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		utils.BadRequestError(c, err.Error())
		return
	}

	userID := c.MustGet("sub").(pgtype.UUID)

	workspace, err := h.q.GetWorkspaceByUserID(c, userID)
	if err != nil {
		utils.InternalServerError(c, err)
		return
	}

	encrypted, err := h.enc.Encrypt(body.Password)
	if err != nil {
		utils.InternalServerError(c, err)
		return
	}

	conn, err := h.q.CreateConnection(c, store.CreateConnectionParams{
		WorkspaceID:       workspace.ID,
		UserID:            userID,
		Name:              body.Name,
		DbType:            body.DBType,
		Host:              body.Host,
		Port:              body.Port,
		DatabaseName:      body.DatabaseName,
		Username:          body.Username,
		PasswordEncrypted: encrypted,
		UseTls:            body.UseTLS,
	})
	if err != nil {
		utils.InternalServerError(c, err)
		return
	}

	c.JSON(http.StatusCreated, utils.Response{
		Success: true,
		Data:    conn,
	})
}

// ListConnections returns all connections for the authenticated user.
func (h *Handler) ListConnections(c *gin.Context) {
	userID := c.MustGet("sub").(pgtype.UUID)

	connections, err := h.q.ListConnections(c, userID)
	if err != nil {
		utils.InternalServerError(c, err)
		return
	}
	if connections == nil {
		connections = []store.ListConnectionsRow{}
	}

	c.JSON(http.StatusOK, utils.Response{
		Success: true,
		Data:    connections,
	})
}

// ProbeConnection tests connection params without saving them.
// Used by the "Test before saving" button on the add-connection form.
func (h *Handler) ProbeConnection(c *gin.Context) {
	var body ProbeConnectionSchema
	if err := c.ShouldBindJSON(&body); err != nil {
		utils.BadRequestError(c, err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	tableCount, err := h.tester.Test(ctx, TestParams{
		DBType:       body.DBType,
		Host:         body.Host,
		Port:         body.Port,
		DatabaseName: body.DatabaseName,
		Username:     body.Username,
		Password:     body.Password,
		UseTLS:       body.UseTLS,
	})
	if err != nil {
		utils.BadRequestError(c, "Connection failed: "+err.Error())
		return
	}

	c.JSON(http.StatusOK, utils.Response{
		Success: true,
		Data: gin.H{
			"message":    "Connection successful",
			"tableCount": tableCount,
		},
	})
}

// TestConnection tests an existing saved connection and updates its status in the DB.
// Returns the test outcome so the client can update the UI without a full re-fetch.
func (h *Handler) TestConnection(c *gin.Context) {
	connID, err := parseUUID(c.Param("id"))
	if err != nil {
		utils.BadRequestError(c, "Invalid connection ID")
		return
	}

	userID := c.MustGet("sub").(pgtype.UUID)

	existing, err := h.q.GetConnectionByID(c, store.GetConnectionByIDParams{
		ID:     connID,
		UserID: userID,
	})
	if err != nil {
		utils.NotFoundError(c, "Connection not found")
		return
	}

	plainPassword, err := h.enc.Decrypt(existing.PasswordEncrypted)
	if err != nil {
		utils.InternalServerError(c, err)
		return
	}

	testCtx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	tableCount, testErr := h.tester.Test(testCtx, TestParams{
		DBType:       fmt.Sprint(existing.DbType),
		Host:         existing.Host,
		Port:         existing.Port,
		DatabaseName: existing.DatabaseName,
		Username:     existing.Username,
		Password:     plainPassword,
		UseTLS:       existing.UseTls,
	})

	status := StatusConnected
	lastError := pgtype.Text{Valid: false}
	if testErr != nil {
		status = StatusError
		lastError = pgtype.Text{String: testErr.Error(), Valid: true}
	}

	result, err := h.q.UpdateConnectionStatus(c, store.UpdateConnectionStatusParams{
		ID:        connID,
		Status:    status,
		LastError: lastError,
		UserID:    userID,
	})
	if err != nil {
		utils.InternalServerError(c, err)
		return
	}

	if testErr == nil {
		_ = h.q.UpdateConnectionSync(c, store.UpdateConnectionSyncParams{
			ID:         connID,
			TableCount: tableCount,
		})
	}

	var errMsg *string
	if result.LastError.Valid {
		errMsg = &result.LastError.String
	}

	c.JSON(http.StatusOK, utils.Response{
		Success: true,
		Data: gin.H{
			"status":       result.Status,
			"lastTestedAt": result.LastTestedAt,
			"tableCount":   tableCount,
			"error":        errMsg,
		},
	})
}

// GetSchema returns the full schema (tables + columns) for a saved connection.
func (h *Handler) GetSchema(c *gin.Context) {
	connID, err := parseUUID(c.Param("id"))
	if err != nil {
		utils.BadRequestError(c, "Invalid connection ID")
		return
	}

	userID := c.MustGet("sub").(pgtype.UUID)

	existing, err := h.q.GetConnectionByID(c, store.GetConnectionByIDParams{
		ID:     connID,
		UserID: userID,
	})
	if err != nil {
		utils.NotFoundError(c, "Connection not found")
		return
	}

	dbType := fmt.Sprint(existing.DbType)
	if dbType != DBTypePostgres {
		c.JSON(http.StatusOK, utils.Response{Success: true, Data: gin.H{"tables": []SchemaTable{}}})
		return
	}

	plainPassword, err := h.enc.Decrypt(existing.PasswordEncrypted)
	if err != nil {
		utils.InternalServerError(c, err)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	tables, err := fetchSchema(ctx, TestParams{
		DBType:       dbType,
		Host:         existing.Host,
		Port:         existing.Port,
		DatabaseName: existing.DatabaseName,
		Username:     existing.Username,
		Password:     plainPassword,
		UseTLS:       existing.UseTls,
	})
	if err != nil {
		utils.InternalServerError(c, fmt.Errorf("schema fetch failed: %w", err))
		return
	}
	if tables == nil {
		tables = []SchemaTable{}
	}

	c.JSON(http.StatusOK, utils.Response{Success: true, Data: gin.H{"tables": tables}})
}

// GetTables returns all user-visible table names for a saved connection.
func (h *Handler) GetTables(c *gin.Context) {
	connID, err := parseUUID(c.Param("id"))
	if err != nil {
		utils.BadRequestError(c, "Invalid connection ID")
		return
	}

	userID := c.MustGet("sub").(pgtype.UUID)

	existing, err := h.q.GetConnectionByID(c, store.GetConnectionByIDParams{
		ID:     connID,
		UserID: userID,
	})
	if err != nil {
		utils.NotFoundError(c, "Connection not found")
		return
	}

	dbType := fmt.Sprint(existing.DbType)
	if dbType != DBTypePostgres {
		c.JSON(http.StatusOK, utils.Response{Success: true, Data: gin.H{"tables": []string{}}})
		return
	}

	plainPassword, err := h.enc.Decrypt(existing.PasswordEncrypted)
	if err != nil {
		utils.InternalServerError(c, err)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	tables, err := fetchTableNames(ctx, TestParams{
		DBType:       dbType,
		Host:         existing.Host,
		Port:         existing.Port,
		DatabaseName: existing.DatabaseName,
		Username:     existing.Username,
		Password:     plainPassword,
		UseTLS:       existing.UseTls,
	})
	if err != nil {
		utils.InternalServerError(c, fmt.Errorf("failed to list tables: %w", err))
		return
	}
	if tables == nil {
		tables = []string{}
	}

	c.JSON(http.StatusOK, utils.Response{Success: true, Data: gin.H{"tables": tables}})
}

// RemoveConnection deletes a saved connection.
func (h *Handler) RemoveConnection(c *gin.Context) {
	connID, err := parseUUID(c.Param("id"))
	if err != nil {
		utils.BadRequestError(c, "Invalid connection ID")
		return
	}

	userID := c.MustGet("sub").(pgtype.UUID)

	if err = h.q.DeleteConnection(c, store.DeleteConnectionParams{
		ID:     connID,
		UserID: userID,
	}); err != nil {
		utils.InternalServerError(c, err)
		return
	}

	c.JSON(http.StatusOK, utils.Response{
		Success: true,
		Data:    gin.H{"message": "Connection removed"},
	})
}

func parseUUID(s string) (pgtype.UUID, error) {
	var id pgtype.UUID
	return id, id.Scan(s)
}
