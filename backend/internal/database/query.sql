-- name: CreateUser :one
INSERT INTO users (email, password_hash)
VALUES ($1, $2)
RETURNING id, email, verified, status, created_at, updated_at;


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