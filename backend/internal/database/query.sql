-- =========================
-- USERS
-- =========================

-- name: CreateUser :one
INSERT INTO users (fullname, email, password_hash)
VALUES ($1, $2, $3)
RETURNING id, fullname, email, verified, status, created_at, updated_at;


-- name: GetUserByID :one
SELECT *
FROM users
WHERE id = $1
  AND deleted_at IS NULL;


-- name: GetUserByEmail :one
SELECT *
FROM users
WHERE email = $1
  AND deleted_at IS NULL;


-- name: UpdateUserVerified :one
UPDATE users
SET verified = $2
WHERE id = $1
  AND deleted_at IS NULL
RETURNING id, email, verified, updated_at;


-- name: UpdateUserStatus :one
UPDATE users
SET status = $2
WHERE id = $1
  AND deleted_at IS NULL
RETURNING id, email, status, updated_at;


-- name: UpdateUserPassword :one
UPDATE users
SET password_hash = $2
WHERE id = $1
  AND deleted_at IS NULL
RETURNING id, updated_at;

-- name: UpdateUserProfile :one
UPDATE users
SET fullname = $2, email=$3
WHERE id = $1
RETURNING id, fullname, email;


-- name: SoftDeleteUser :one
UPDATE users
SET deleted_at = NOW()
WHERE id = $1
  AND deleted_at IS NULL
RETURNING id, deleted_at;


-- name: UpdateLastLogin :exec
UPDATE users
SET last_login_at = NOW()
WHERE id = $1
  AND deleted_at IS NULL;


-- =========================
-- OTPS
-- =========================

-- name: CreateOtp :one
INSERT INTO otps (
    user_id,
    otp_hash,
    type,
    expires_at
)
VALUES ($1, $2, $3, $4)
RETURNING id, user_id, type, expires_at, created_at;


-- name: GetValidOtp :one
SELECT *
FROM otps
WHERE user_id = $1
  AND type = $2
  AND consumed = FALSE
  AND expires_at > NOW()
ORDER BY created_at DESC
LIMIT 1;


-- name: ConsumeOtp :one
UPDATE otps
SET consumed = TRUE
WHERE id = $1
  AND consumed = FALSE
  AND expires_at > NOW()
RETURNING id, consumed;


-- Invalidates any active (unconsumed) OTPs of a given type for a user,
-- regardless of whether they're expired or not. Call this before issuing
-- a fresh OTP so only one is ever live per (user, type).
-- name: InvalidateOtpsByType :exec
UPDATE otps
SET consumed = TRUE
WHERE user_id = $1
  AND type = $2
  AND consumed = FALSE;


-- Hard-deletes any OTP for a user/type that is either already consumed
-- or expired. Use this if you'd rather purge stale rows on every new
-- OTP request instead of relying solely on the cron.
-- name: DeleteStaleOtpsByType :exec
DELETE FROM otps
WHERE user_id = $1
  AND type = $2
  AND (consumed = TRUE OR expires_at <= NOW());


-- Cron sweep: purges everything that's no longer useful, across all users.
-- name: DeleteExpiredOtps :exec
DELETE FROM otps
WHERE expires_at < NOW()
   OR consumed = TRUE;


-- =========================
-- SESSIONS
-- =========================

-- name: CreateSession :one
INSERT INTO sessions (
    user_id,
    user_agent,
    ip_address,
    expires_at
)
VALUES ($1, $2, $3, $4)
RETURNING *;


-- name: GetSessionByID :one
SELECT *
FROM sessions
WHERE id = $1
  AND is_revoked = FALSE
  AND expires_at > NOW();


-- name: UpdateSessionLastUsed :exec
UPDATE sessions
SET last_used_at = NOW()
WHERE id = $1
  AND is_revoked = FALSE;


-- Revokes a single session. Pair with RevokeRefreshTokensBySessionID
-- inside a transaction to cascade revocation to its refresh tokens.
-- name: RevokeSessionByID :exec
UPDATE sessions
SET is_revoked = TRUE
WHERE id = $1;


-- Revokes every refresh token tied to a session.
-- name: RevokeRefreshTokensBySessionID :exec
UPDATE refresh_tokens
SET is_revoked = TRUE
WHERE session_id = $1
  AND is_revoked = FALSE;


-- Revokes every session belonging to a user.
-- Pair with RevokeAllUserRefreshTokensByUserID inside a transaction.
-- name: RevokeAllUserSessionsByUserID :exec
UPDATE sessions
SET is_revoked = TRUE
WHERE user_id = $1;


-- Revokes every refresh token belonging to a user.
-- name: RevokeAllUserRefreshTokensByUserID :exec
UPDATE refresh_tokens
SET is_revoked = TRUE
WHERE user_id = $1
  AND is_revoked = FALSE;


-- name: DeleteExpiredSessions :exec
DELETE FROM sessions
WHERE expires_at < NOW();


-- =========================
-- REFRESH TOKENS
-- =========================

-- name: CreateRefreshToken :one
INSERT INTO refresh_tokens (
    session_id,
    user_id,
    token_hash,
    expires_at
)
VALUES ($1, $2, $3, $4)
RETURNING *;


-- name: GetRefreshToken :one
SELECT *
FROM refresh_tokens
WHERE token_hash = $1
  AND is_revoked = FALSE
  AND expires_at > NOW();


-- name: GetRefreshTokenByID :one
SELECT *
FROM refresh_tokens
WHERE id = $1;


-- name: RotateRefreshToken :one
UPDATE refresh_tokens
SET is_revoked = TRUE,
    replaced_by_token_id = $2
WHERE id = $1
  AND is_revoked = FALSE
RETURNING *;


-- name: RevokeRefreshToken :exec
UPDATE refresh_tokens
SET is_revoked = TRUE
WHERE id = $1;


-- name: RevokeAllSessionTokens :exec
UPDATE refresh_tokens
SET is_revoked = TRUE
WHERE session_id = $1;


-- name: DeleteExpiredRefreshTokens :exec
DELETE FROM refresh_tokens
WHERE expires_at < NOW();


-- =========================
-- WORKSPACES
-- =========================

-- name: CreateWorkspace :one
INSERT INTO workspaces (user_id)
VALUES ($1)
RETURNING *;

-- name: GetWorkspaceByUserID :one
SELECT * FROM workspaces WHERE user_id = $1;

-- =========================
-- API KEYS
-- =========================

-- name: SaveAPIKey :one
INSERT INTO api_keys (user_id, provider, model, key_encrypted, key_hint)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetActiveAPIKey :one
SELECT * FROM api_keys
WHERE user_id = $1 AND is_active = TRUE
LIMIT 1;

-- name: RotateAPIKey :one
UPDATE api_keys
SET key_encrypted = $2,
    key_hint      = $3,
    model         = $4,
    last_used_at  = NULL
WHERE user_id = $1 AND is_active = TRUE
RETURNING *;

-- name: RevokeAPIKey :exec
UPDATE api_keys SET is_active = FALSE
WHERE user_id = $1 AND is_active = TRUE;

-- name: TouchAPIKey :exec
UPDATE api_keys SET last_used_at = NOW() WHERE id = $1;

-- =========================
-- CONVERSATIONS
-- =========================

-- name: CreateConversation :one
INSERT INTO conversations (user_id, connection_id, title)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetConversation :one
SELECT * FROM conversations WHERE id = $1 AND user_id = $2;

-- name: ListConversations :many
SELECT
    c.id,
    c.user_id,
    c.connection_id,
    c.title,
    c.created_at,
    c.updated_at,
    conn.name AS connection_name,
    conn.db_type AS connection_db_type
FROM conversations c
JOIN connections conn ON c.connection_id = conn.id
WHERE c.user_id = $1
ORDER BY c.updated_at DESC;

-- name: TouchConversation :exec
UPDATE conversations SET updated_at = NOW() WHERE id = $1;

-- name: DeleteConversation :exec
DELETE FROM conversations WHERE id = $1 AND user_id = $2;

-- =========================
-- MESSAGES
-- =========================

-- name: CreateMessage :one
INSERT INTO messages (
    conversation_id, role, content, input_mode,
    interpretation, sql_query,
    execution_time_ms, row_count, col_count,
    result_data, is_cached, error
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
RETURNING *;

-- name: ListMessages :many
SELECT * FROM messages
WHERE conversation_id = $1
ORDER BY created_at ASC;

-- =========================
-- CONNECTIONS
-- =========================

-- name: CreateConnection :one
INSERT INTO connections (
    workspace_id,
    user_id,
    name,
    db_type,
    host,
    port,
    database_name,
    username,
    password_encrypted,
    use_tls
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING id, workspace_id, user_id, name, db_type, host, port, database_name, username, use_tls, status, last_tested_at, last_error, table_count, last_synced_at, created_at, updated_at;

-- name: GetConnectionByID :one
SELECT *
FROM connections
WHERE id = $1
  AND user_id = $2;

-- name: ListConnections :many
SELECT id, workspace_id, user_id, name, db_type, host, port, database_name, username, use_tls, status, last_tested_at, last_error, table_count, last_synced_at, created_at, updated_at
FROM connections
WHERE user_id = $1
ORDER BY created_at DESC;

-- name: UpdateConnectionStatus :one
UPDATE connections
SET status        = $2,
    last_tested_at = NOW(),
    last_error    = $3
WHERE id      = $1
  AND user_id = $4
RETURNING id, status, last_tested_at, last_error, updated_at;

-- name: UpdateConnectionSync :exec
UPDATE connections
SET table_count   = $2,
    last_synced_at = NOW()
WHERE id = $1;

-- name: DeleteConnection :exec
DELETE FROM connections
WHERE id      = $1
  AND user_id = $2;