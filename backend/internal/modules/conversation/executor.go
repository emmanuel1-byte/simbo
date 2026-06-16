package conversation

import (
	"context"
	"fmt"
	"os"
	"time"

	"simbo-api-service/internal/database/store"

	"github.com/jackc/pgx/v5"
)

// resolveHost rewrites localhost/127.0.0.1 to host.docker.internal when the
// app is running inside Docker, so saved connections still reach the host machine.
func resolveHost(host string) string {
	if os.Getenv("IN_DOCKER") == "true" && (host == "localhost" || host == "127.0.0.1" || host == "::1") {
		return "host.docker.internal"
	}
	return host
}

// Executor runs a validated SQL query against a user's database in a READ ONLY
// transaction. The database engine enforces read-only access — no application
// check can be bypassed.
type Executor interface {
	Execute(ctx context.Context, conn store.Connection, password, sql string) (*QueryResult, time.Duration, error)
}

// LiveExecutor opens a real connection per query.
type LiveExecutor struct{}

func (LiveExecutor) Execute(ctx context.Context, conn store.Connection, password, sql string) (*QueryResult, time.Duration, error) {
	sslMode := "require"
	if !conn.UseTls {
		sslMode = "disable"
	}
	dsn := fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=%s",
		conn.Username, password, resolveHost(conn.Host), conn.Port, conn.DatabaseName, sslMode)

	c, err := pgx.Connect(ctx, dsn)
	if err != nil {
		return nil, 0, fmt.Errorf("connect: %w", err)
	}
	defer c.Close(ctx)

	// Belt-and-suspenders: application-level statement timeout
	if _, err = c.Exec(ctx, "SET statement_timeout = '30000'"); err != nil {
		return nil, 0, err
	}

	// Database-level enforcement: Postgres rejects any write inside a READ ONLY tx
	tx, err := c.BeginTx(ctx, pgx.TxOptions{AccessMode: pgx.ReadOnly})
	if err != nil {
		return nil, 0, err
	}
	defer tx.Rollback(ctx)

	start := time.Now()
	rows, err := tx.Query(ctx, sql)
	if err != nil {
		return nil, 0, fmt.Errorf("query: %w", err)
	}
	defer rows.Close()

	// Column names
	fields := rows.FieldDescriptions()
	cols := make([]string, len(fields))
	for i, f := range fields {
		cols[i] = string(f.Name)
	}

	// Rows
	var result [][]any
	for rows.Next() {
		vals, err := rows.Values()
		if err != nil {
			return nil, 0, err
		}
		result = append(result, vals)
	}
	if err = rows.Err(); err != nil {
		return nil, 0, err
	}
	elapsed := time.Since(start)

	_ = tx.Rollback(ctx) // READ ONLY — always rollback

	if result == nil {
		result = [][]any{}
	}
	return &QueryResult{Columns: cols, Rows: result}, elapsed, nil
}
