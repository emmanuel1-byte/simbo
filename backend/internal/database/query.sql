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


-- name: SoftDeleteUser :one
UPDATE users
SET deleted_at = NOW()
WHERE id = $1
  AND deleted_at IS NULL
RETURNING id, deleted_at;


-- name: UpdateLastLogin :exec
UPDATE users
SET last_login_at = NOW()
WHERE id = $1;


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
RETURNING id, consumed;


-- name: InvalidateOtpsByType :exec
UPDATE otps
SET consumed = TRUE
WHERE user_id = $1
  AND type = $2
  AND consumed = FALSE;


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
WHERE id = $1;


-- name: RevokeSession :exec
UPDATE sessions
SET is_revoked = TRUE
WHERE id = $1;


-- name: RevokeAllUserSessions :exec
UPDATE sessions
SET is_revoked = TRUE
WHERE user_id = $1;


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