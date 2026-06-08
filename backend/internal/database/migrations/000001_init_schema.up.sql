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
-- email UNIQUE already provides an index for lookups.
-- Partial index kept only for soft-delete-aware queries; drop if not used.
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