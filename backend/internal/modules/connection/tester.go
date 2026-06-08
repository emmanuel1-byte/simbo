package connection

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
)

// TestParams holds decrypted connection details for a connectivity test.
type TestParams struct {
	DBType       string
	Host         string
	Port         int32
	DatabaseName string
	Username     string
	Password     string
	UseTLS       bool
}

// Tester tests a database connection and returns the user-visible table count.
// Inject LiveTester in production, MockTester in tests.
type Tester interface {
	Test(ctx context.Context, p TestParams) (tableCount int32, err error)
}

// LiveTester opens a real connection to the target database.
type LiveTester struct{}

func (LiveTester) Test(ctx context.Context, p TestParams) (int32, error) {
	switch p.DBType {
	case DBTypePostgres:
		return testPostgres(ctx, p)
	case DBTypeMySQL:
		return 0, fmt.Errorf("MySQL support is not yet available")
	case DBTypeSnowflake:
		return 0, fmt.Errorf("Snowflake support is not yet available")
	case DBTypeBigQuery:
		return 0, fmt.Errorf("BigQuery support is not yet available")
	case DBTypeSQLite:
		return 0, fmt.Errorf("SQLite support is not yet available")
	default:
		return 0, fmt.Errorf("unsupported database type: %q", p.DBType)
	}
}

// SchemaColumn describes a single column in a table.
type SchemaColumn struct {
	Name     string `json:"name"`
	DataType string `json:"type"`
	Nullable bool   `json:"nullable"`
}

// SchemaTable describes one table with its columns.
type SchemaTable struct {
	Name    string         `json:"name"`
	Columns []SchemaColumn `json:"columns"`
}

// fetchSchema returns the full schema (tables + columns) for a Postgres connection.
func fetchSchema(ctx context.Context, p TestParams) ([]SchemaTable, error) {
	sslMode := "require"
	if !p.UseTLS {
		sslMode = "disable"
	}
	dsn := fmt.Sprintf(
		"postgres://%s:%s@%s:%d/%s?sslmode=%s",
		p.Username, p.Password, p.Host, p.Port, p.DatabaseName, sslMode,
	)
	conn, err := pgx.Connect(ctx, dsn)
	if err != nil {
		return nil, err
	}
	defer conn.Close(ctx)

	rows, err := conn.Query(ctx, `
		SELECT c.table_name, c.column_name, c.data_type, c.is_nullable
		FROM information_schema.tables t
		JOIN information_schema.columns c
		  ON t.table_name = c.table_name AND t.table_schema = c.table_schema
		WHERE t.table_schema NOT IN ('information_schema','pg_catalog')
		  AND t.table_type = 'BASE TABLE'
		ORDER BY c.table_name, c.ordinal_position
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	index := make(map[string]int)
	var tables []SchemaTable
	for rows.Next() {
		var tbl, col, dtype, nullable string
		if err := rows.Scan(&tbl, &col, &dtype, &nullable); err != nil {
			return nil, err
		}
		if _, exists := index[tbl]; !exists {
			index[tbl] = len(tables)
			tables = append(tables, SchemaTable{Name: tbl})
		}
		tables[index[tbl]].Columns = append(tables[index[tbl]].Columns, SchemaColumn{
			Name:     col,
			DataType: dtype,
			Nullable: nullable == "YES",
		})
	}
	return tables, rows.Err()
}

// fetchTableNames returns user-visible table names for a Postgres connection.
func fetchTableNames(ctx context.Context, p TestParams) ([]string, error) {
	sslMode := "require"
	if !p.UseTLS {
		sslMode = "disable"
	}
	dsn := fmt.Sprintf(
		"postgres://%s:%s@%s:%d/%s?sslmode=%s",
		p.Username, p.Password, p.Host, p.Port, p.DatabaseName, sslMode,
	)
	conn, err := pgx.Connect(ctx, dsn)
	if err != nil {
		return nil, err
	}
	defer conn.Close(ctx)

	rows, err := conn.Query(ctx, `
		SELECT table_name
		FROM information_schema.tables
		WHERE table_schema NOT IN ('information_schema','pg_catalog')
		  AND table_type = 'BASE TABLE'
		ORDER BY table_name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tables []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		tables = append(tables, name)
	}
	return tables, rows.Err()
}

func testPostgres(ctx context.Context, p TestParams) (int32, error) {
	sslMode := "require"
	if !p.UseTLS {
		sslMode = "disable"
	}
	dsn := fmt.Sprintf(
		"postgres://%s:%s@%s:%d/%s?sslmode=%s",
		p.Username, p.Password, p.Host, p.Port, p.DatabaseName, sslMode,
	)
	conn, err := pgx.Connect(ctx, dsn)
	if err != nil {
		return 0, err
	}
	defer conn.Close(ctx)

	var count int32
	err = conn.QueryRow(ctx, `
		SELECT COUNT(*)::int
		FROM information_schema.tables
		WHERE table_schema NOT IN ('information_schema','pg_catalog')
		  AND table_type = 'BASE TABLE'
	`).Scan(&count)
	return count, err
}
