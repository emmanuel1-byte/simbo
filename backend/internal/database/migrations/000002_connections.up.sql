-- =========================
-- ENUMS
-- =========================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'db_type') THEN
        CREATE TYPE db_type AS ENUM ('postgres', 'mysql', 'snowflake', 'bigquery', 'sqlite');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'connection_status') THEN
        CREATE TYPE connection_status AS ENUM ('connected', 'error', 'pending');
    END IF;
END$$;

-- =========================
-- CONNECTIONS
-- =========================
CREATE TABLE IF NOT EXISTS connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    db_type db_type NOT NULL,

    host TEXT NOT NULL,
    port INTEGER NOT NULL,
    database_name TEXT NOT NULL,
    username TEXT NOT NULL,
    password_encrypted TEXT NOT NULL,
    use_tls BOOLEAN NOT NULL DEFAULT TRUE,

    status connection_status NOT NULL DEFAULT 'pending',
    last_tested_at TIMESTAMPTZ,
    last_error TEXT,

    table_count INTEGER NOT NULL DEFAULT 0,
    last_synced_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER connections_set_updated_at
BEFORE UPDATE ON connections
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_connections_user_id ON connections(user_id);
CREATE INDEX IF NOT EXISTS idx_connections_workspace_id ON connections(workspace_id);
