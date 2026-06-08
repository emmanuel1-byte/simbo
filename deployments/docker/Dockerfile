# =============================================================================
# Stage 1 — Frontend builder
# =============================================================================
FROM node:20-alpine AS frontend-builder

WORKDIR /build

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --frozen-lockfile

COPY frontend/ .

ARG NEXT_PUBLIC_API_URL=http://localhost:9090/api
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# =============================================================================
# Stage 2 — Backend builder
# =============================================================================
FROM golang:1.25-alpine AS backend-builder

WORKDIR /build

RUN apk add --no-cache git

COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ .

# Statically-linked binary, debug info stripped, no CGO.
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-s -w -extldflags=-static" -trimpath -o /out/api ./cmd/api

# =============================================================================
# Stage 3 — Runtime image
# =============================================================================
FROM node:20-alpine AS runtime

RUN apk add --no-cache \
        supervisor \
        wget \
    && rm -rf /var/cache/apk/*

# Least-privilege non-root user.
RUN addgroup -S simbo && adduser -S simbo -G simbo

WORKDIR /app

# ── Go binary & migrations ────────────────────────────────────────────────────
COPY --from=backend-builder --chown=simbo:simbo /out/api         ./api
COPY --from=backend-builder --chown=simbo:simbo /build/internal/database/migrations ./migrations

# ── Next.js standalone bundle ─────────────────────────────────────────────────
COPY --from=frontend-builder --chown=simbo:simbo /build/.next/standalone   ./frontend/
COPY --from=frontend-builder --chown=simbo:simbo /build/.next/static       ./frontend/.next/static/
COPY --from=frontend-builder --chown=simbo:simbo /build/public             ./frontend/public/

# ── Supervisor config ─────────────────────────────────────────────────────────
COPY deployments/docker/supervisord.conf /etc/supervisord.conf

# ── Environment ───────────────────────────────────────────────────────────────
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    MIGRATIONS_PATH=/app/migrations \
    GIN_MODE=release

EXPOSE 3000 9090

HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=3 \
    CMD wget -qO- http://localhost:9090/healthz || exit 1

# supervisord runs as root to manage child processes;
# individual programs run as the unprivileged simbo user (see supervisord.conf).
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
