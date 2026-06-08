-- =========================
-- EXTENSIONS
-- =========================
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- =========================
-- ENUMS
-- =========================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
        CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'otp_type') THEN
        CREATE TYPE otp_type AS ENUM ('email_verification', 'password_reset');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'db_type') THEN
        CREATE TYPE db_type AS ENUM ('postgres', 'mysql', 'snowflake', 'bigquery', 'sqlite');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'connection_status') THEN
        CREATE TYPE connection_status AS ENUM ('connected', 'error', 'pending');
    END IF;
END$$;

-- =========================
-- USERS
-- =========================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fullname VARCHAR(255) NOT NULL,
    email CITEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,

    verified BOOLEAN NOT NULL DEFAULT FALSE,
    status user_status NOT NULL DEFAULT 'active',

    last_login_at TIMESTAMPTZ,

    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================
-- SESSIONS (per device)
-- =========================
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    user_agent TEXT,
    ip_address INET,

    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,

    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================
-- REFRESH TOKENS (rotating)
-- =========================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    token_hash TEXT NOT NULL UNIQUE,

    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    replaced_by_token_id UUID REFERENCES refresh_tokens(id) ON DELETE SET NULL,

    expires_at TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================
-- OTPS
-- =========================
CREATE TABLE IF NOT EXISTS otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    otp_hash TEXT NOT NULL,
    type otp_type NOT NULL,

    consumed BOOLEAN NOT NULL DEFAULT FALSE,

    expires_at TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================
-- WORKSPACES
-- =========================
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================
-- TRIGGER FUNCTION
-- =========================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================
-- TRIGGERS
-- =========================

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS sessions_set_updated_at ON sessions;
CREATE TRIGGER sessions_set_updated_at
BEFORE UPDATE ON sessions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS refresh_tokens_set_updated_at ON refresh_tokens;
CREATE TRIGGER refresh_tokens_set_updated_at
BEFORE UPDATE ON refresh_tokens
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS otps_set_updated_at ON otps;
CREATE TRIGGER otps_set_updated_at
BEFORE UPDATE ON otps
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS workspaces_set_updated_at ON workspaces;
CREATE TRIGGER workspaces_set_updated_at
BEFORE UPDATE ON workspaces
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =========================
-- INDEXES
-- =========================

-- USERS
CREATE INDEX IF NOT EXISTS idx_users_active_email
ON users(email)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_status
ON users(status)
WHERE deleted_at IS NULL;

-- SESSIONS
CREATE INDEX IF NOT EXISTS idx_sessions_user_active
ON sessions(user_id, expires_at)
WHERE is_revoked = FALSE;

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at
ON sessions(expires_at);

-- REFRESH TOKENS
CREATE INDEX IF NOT EXISTS idx_refresh_session
ON refresh_tokens(session_id);

CREATE INDEX IF NOT EXISTS idx_refresh_session_active
ON refresh_tokens(session_id)
WHERE is_revoked = FALSE;

CREATE INDEX IF NOT EXISTS idx_refresh_expires_at
ON refresh_tokens(expires_at);

-- OTPS
CREATE INDEX IF NOT EXISTS idx_otps_user_type
ON otps(user_id, type);

CREATE UNIQUE INDEX IF NOT EXISTS idx_otps_one_active_per_type
ON otps(user_id, type)
WHERE consumed = FALSE;

CREATE INDEX IF NOT EXISTS idx_otps_expires_at
ON otps(expires_at);

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

-- =========================
-- API KEYS (BYOK)
-- =========================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'llm_provider') THEN
        CREATE TYPE llm_provider AS ENUM ('openai', 'anthropic');
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider llm_provider NOT NULL,
    model VARCHAR(100) NOT NULL,
    key_encrypted TEXT NOT NULL,
    key_hint VARCHAR(20) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_one_active_per_user
ON api_keys(user_id) WHERE is_active = TRUE;

-- =========================
-- CONVERSATIONS
-- =========================
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
    title VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_updated
ON conversations(user_id, updated_at DESC);

-- =========================
-- MESSAGES
-- =========================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    input_mode TEXT NOT NULL DEFAULT 'text' CHECK (input_mode IN ('text', 'voice')),
    interpretation JSONB,
    sql_query TEXT,
    execution_time_ms INTEGER,
    row_count INTEGER,
    col_count INTEGER,
    result_data JSONB,
    is_cached BOOLEAN NOT NULL DEFAULT FALSE,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation
ON messages(conversation_id, created_at ASC);

-- =========================
-- CLEANUP (manual or cron)
-- =========================
-- DELETE FROM refresh_tokens WHERE expires_at < NOW();
-- DELETE FROM sessions WHERE expires_at < NOW();
-- DELETE FROM otps WHERE consumed = TRUE OR expires_at < NOW();