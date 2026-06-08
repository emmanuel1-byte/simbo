package conversation

import (
	"context"
	"fmt"
	"strings"

	"simbo-api-service/internal/database/store"

	"github.com/jackc/pgx/v5"
)

const introspectSQL = `
SELECT
    c.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable
FROM information_schema.tables t
JOIN information_schema.columns c
    ON t.table_name = c.table_name
   AND t.table_schema = c.table_schema
WHERE t.table_schema NOT IN ('information_schema','pg_catalog')
  AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position
`

// Introspector fetches a human-readable schema from a user's database.
type Introspector interface {
	Introspect(ctx context.Context, conn store.Connection, password string) (string, error)
}

// LiveIntrospector connects to the real target database.
type LiveIntrospector struct{}

func (LiveIntrospector) Introspect(ctx context.Context, conn store.Connection, password string) (string, error) {
	sslMode := "require"
	if !conn.UseTls {
		sslMode = "disable"
	}
	dsn := fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=%s",
		conn.Username, password, conn.Host, conn.Port, conn.DatabaseName, sslMode)

	c, err := pgx.Connect(ctx, dsn)
	if err != nil {
		return "", fmt.Errorf("schema introspection failed: %w", err)
	}
	defer c.Close(ctx)

	tableOrder, tables, err := scanSchema(c, ctx)
	if err != nil {
		return "", err
	}
	return renderSchema(tableOrder, tables), nil
}

func scanSchema(c *pgx.Conn, ctx context.Context) ([]string, map[string][]string, error) {
	rows, err := c.Query(ctx, introspectSQL)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	tables := make(map[string][]string)
	var order []string
	seen := make(map[string]bool)

	for rows.Next() {
		var tableName, columnName, dataType, isNullable string
		if err = rows.Scan(&tableName, &columnName, &dataType, &isNullable); err != nil {
			return nil, nil, err
		}
		if !seen[tableName] {
			order = append(order, tableName)
			seen[tableName] = true
		}
		nullable := ""
		if isNullable == "NO" {
			nullable = " NOT NULL"
		}
		tables[tableName] = append(tables[tableName],
			fmt.Sprintf("  - %s: %s%s", columnName, dataType, nullable))
	}
	return order, tables, rows.Err()
}

func renderSchema(order []string, tables map[string][]string) string {
	var sb strings.Builder
	for i, t := range order {
		fmt.Fprintf(&sb, "Table: %s\n", t)
		for _, col := range tables[t] {
			sb.WriteString(col)
			sb.WriteByte('\n')
		}
		if i < len(order)-1 {
			sb.WriteByte('\n')
		}
	}
	return sb.String()
}
