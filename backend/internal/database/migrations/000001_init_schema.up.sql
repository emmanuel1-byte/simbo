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
    fullname VARCHAR(225) NOT NULL,
    email CITEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,

    verified BOOLEAN DEFAULT FALSE,
    status user_status DEFAULT 'active',

    last_login_at TIMESTAMPTZ,

    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================
-- SESSIONS (per device)
-- =========================
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    user_agent TEXT,
    ip_address INET,

    is_revoked BOOLEAN DEFAULT FALSE,

    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================
-- REFRESH TOKENS (rotating)
-- =========================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    token_hash TEXT NOT NULL UNIQUE,

    is_revoked BOOLEAN DEFAULT FALSE,
    replaced_by_token_id UUID REFERENCES refresh_tokens(id),

    expires_at TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================
-- OTPS
-- =========================
CREATE TABLE IF NOT EXISTS otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    otp_hash TEXT NOT NULL,
    type otp_type NOT NULL,

    consumed BOOLEAN DEFAULT FALSE,

    expires_at TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
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
-- TRIGGERS (apply to all tables)
-- =========================

-- USERS
DROP TRIGGER IF EXISTS set_updated_at ON users;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- SESSIONS
DROP TRIGGER IF EXISTS set_updated_at ON sessions;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON sessions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- REFRESH TOKENS
DROP TRIGGER IF EXISTS set_updated_at ON refresh_tokens;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON refresh_tokens
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- OTPS
DROP TRIGGER IF EXISTS set_updated_at ON otps;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON otps
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

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
CREATE INDEX IF NOT EXISTS idx_sessions_user
ON sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_sessions_active
ON sessions(user_id)
WHERE is_revoked = FALSE;

-- REFRESH TOKENS
CREATE INDEX IF NOT EXISTS idx_refresh_session
ON refresh_tokens(session_id);

CREATE INDEX IF NOT EXISTS idx_refresh_active
ON refresh_tokens(session_id)
WHERE is_revoked = FALSE;

-- OTPS
CREATE INDEX IF NOT EXISTS idx_otps_user_type
ON otps(user_id, type);

CREATE INDEX IF NOT EXISTS idx_otps_active
ON otps(user_id)
WHERE consumed = FALSE;
