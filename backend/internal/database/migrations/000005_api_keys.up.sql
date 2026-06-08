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

-- Only one active key per user at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_one_active_per_user
ON api_keys(user_id) WHERE is_active = TRUE;

CREATE TRIGGER api_keys_set_updated_at
BEFORE UPDATE ON api_keys
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
