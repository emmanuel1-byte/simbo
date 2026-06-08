package conversation

import (
	"errors"
	"regexp"
	"strings"
)

var (
	ErrNotSelectQuery    = errors.New("only SELECT queries are permitted")
	ErrMultipleStatements = errors.New("multiple statements are not allowed")
	ErrDangerousKeyword  = errors.New("query contains a disallowed keyword or function")
)

// writePattern matches SQL write/DDL/DCL keywords at word boundaries.
// Applied AFTER stripping string literals and comments to prevent false positives.
var writePattern = regexp.MustCompile(
	`(?i)\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|MERGE|REPLACE|` +
		`UPSERT|GRANT|REVOKE|EXECUTE|CALL|COPY|VACUUM|CLUSTER|REINDEX|` +
		`IMPORT|EXPORT|LOAD|WRITE|LOCK)\b`,
)

// dangerousPattern matches functions that can read/write server files or cause DoS.
var dangerousPattern = regexp.MustCompile(
	`(?i)\b(PG_READ_FILE|PG_WRITE_FILE|PG_READ_BINARY_FILE|PG_SLEEP|` +
		`LO_IMPORT|LO_EXPORT|DBLINK|PG_EXEC|COPY_TO|COPY_FROM)\b`,
)

// ValidateSQL performs application-level guardrail checks.
// Database-level enforcement (READ ONLY transaction) is the second layer.
func ValidateSQL(sql string) error {
	// Strip comments and literals first, then trim — comments at the top
	// (e.g. "-- read-only · validated · safe-mode") must not block valid SELECTs.
	cleaned := strings.TrimSpace(stripCommentsAndLiterals(strings.TrimSpace(sql)))
	upper := strings.ToUpper(cleaned)

	// Must open with SELECT or WITH (CTEs)
	if !strings.HasPrefix(upper, "SELECT") && !strings.HasPrefix(upper, "WITH") {
		return ErrNotSelectQuery
	}

	// No write / DDL / DCL keywords
	if writePattern.MatchString(cleaned) {
		return ErrDangerousKeyword
	}

	// No dangerous server-side functions
	if dangerousPattern.MatchString(cleaned) {
		return ErrDangerousKeyword
	}

	// No multiple statements (bare semicolons outside string literals were
	// already removed by stripCommentsAndLiterals, so any remaining ';' is real)
	stripped := strings.TrimRight(cleaned, " \t\n\r;")
	if strings.ContainsRune(stripped, ';') {
		return ErrMultipleStatements
	}

	return nil
}

// stripCommentsAndLiterals removes SQL comments and string literal content so
// that words inside them cannot trigger false-positive keyword matches.
func stripCommentsAndLiterals(sql string) string {
	var b strings.Builder
	b.Grow(len(sql))

	i := 0
	for i < len(sql) {
		// Block comment /* ... */
		if i+1 < len(sql) && sql[i] == '/' && sql[i+1] == '*' {
			end := strings.Index(sql[i+2:], "*/")
			if end < 0 {
				break // unterminated — stop here
			}
			b.WriteByte(' ')
			i += end + 4
			continue
		}
		// Line comment -- ...
		if i+1 < len(sql) && sql[i] == '-' && sql[i+1] == '-' {
			end := strings.IndexByte(sql[i:], '\n')
			if end < 0 {
				break
			}
			b.WriteByte('\n')
			i += end + 1
			continue
		}
		// Single-quoted string literal
		if sql[i] == '\'' {
			b.WriteByte('\'')
			i++
			for i < len(sql) {
				if sql[i] == '\'' {
					b.WriteByte('\'')
					i++
					// Escaped quote ''
					if i < len(sql) && sql[i] == '\'' {
						b.WriteByte('\'')
						i++
						continue
					}
					break
				}
				b.WriteByte('_') // replace literal content with innocuous char
				i++
			}
			continue
		}
		b.WriteByte(sql[i])
		i++
	}
	return b.String()
}
