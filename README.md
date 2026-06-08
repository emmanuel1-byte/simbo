# Simbo

**Talk to your database like a person. Read-only by design.**

Simbo turns plain-English questions into safe, validated SQL, executes them against your connected database, and returns the answer with the generated SQL, the model's interpretation, and a full execution timeline — so you always know exactly what ran and why.

---

## Table of Contents

- [Why Simbo](#why-simbo)
- [Application Architecture](#application-architecture)
  - [System Overview](#system-overview)
  - [Frontend](#frontend)
  - [Backend](#backend)
  - [Database](#database)
  - [Query Pipeline — the core flow](#query-pipeline--the-core-flow)
- [Security Architecture](#security-architecture)
- [Deployment Architecture](#deployment-architecture)
  - [Infrastructure](#infrastructure)
  - [Container Layout](#container-layout)
  - [CI/CD Pipeline](#cicd-pipeline)
- [Local Development](#local-development)

---

## Why Simbo

Most "ask your database" tools fall into one of two camps:

1. **Pretty chatbots** that hallucinate SQL, hide what ran, and make engineers nervous.
2. **Heavy BI suites** that take a week to set up and a quarter to onboard.

Simbo sits between them. It is opinionated about three things:

- **Read-only or nothing.** Every generated query is parsed and re-validated server-side before it touches your database. `INSERT`, `UPDATE`, `DELETE`, `DROP`, `TRUNCATE` — all blocked at the engine, not just the prompt.
- **Show your work.** The inline inspector exposes the model's interpretation, the exact SQL, and a step-by-step execution timeline (parse → generate → validate → execute → summarize). Engineers do not have to trust the answer; they can read it.
- **Bring your own key.** Simbo does not ship its own LLM quota. You connect OpenAI, Anthropic, or Gemini. Keys are encrypted at rest with AES-256, per user. Prompt and response bodies are never logged.

---

## Application Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser / Client                         │
│                      Next.js 14 (App Router)                     │
└────────────────────────────┬────────────────────────────────────┘
                             │  HTTPS  (REST + SSE)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Go API  (Gin framework)                      │
│                                                                   │
│  ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌──────────────────┐  │
│  │   auth   │ │ profile  │ │ connection │ │  conversation    │  │
│  └──────────┘ └──────────┘ └────────────┘ │  (query pipeline)│  │
│  ┌──────────┐ ┌──────────┐                └────────┬─────────┘  │
│  │  apikey  │ │ security │                         │            │
│  └──────────┘ └──────────┘                         │            │
│                                                     │ SQL stream │
│  Middleware stack:                                  ▼            │
│    Security headers → Rate limiter → JWT auth    ┌──────────┐   │
│    → Structured logger → Recovery                │   LLM    │   │
│                                                  │ (Gemini/ │   │
└─────────────────────────────────────────────────┤ OpenAI / │   │
                             │                    │ Anthropic)│   │
                             │                    └──────────┘   │
                             ▼                                    │
┌─────────────────────────────────────────────────────────────────┐
│                     PostgreSQL 16                                 │
│  users · sessions · refresh_tokens · otps · workspaces           │
│  connections · api_keys · conversations · messages               │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼  (at query time only)
                    User's connected database
                  (Postgres · MySQL · Snowflake)
```

---

### Frontend

**Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS

#### Route groups

| Group | Routes | Purpose |
|---|---|---|
| `(auth)` | `/signin`, `/signup`, `/verify-otp`, `/forgot-password` | Unauthenticated auth flows |
| `(app)` | `/chat/[id]`, `/history`, `/settings/*` | Authenticated application |

#### Key components

| Component | Role |
|---|---|
| `AppRail` | Narrow left navigation rail; switches to contextual settings nav on `/settings/*` |
| `AskBox` | Query composer — text input, voice input (Web Speech API), database selector |
| `ChatThread` | Renders the conversation; user bubbles right-aligned, Simbo cards left-aligned |
| `Inspector` (inline) | Collapsible SQL / Timeline / Intent panels inside each assistant message |
| `SuggestedPrompts` | Dynamic prompt suggestions generated from the connected DB's live schema |
| `AddConnectionModal` | Database connection wizard with live probe test |

#### State and data flow

```
AuthContext  ──────────────────────────────────────────────────────────┐
                                                                        │
useAskFlow (SSE hook)                                                   │
  └─ ask()  → POST /api/v1/conversations/:id/messages                  │
       ├─ streams: step events → liveSteps[]                           │
       ├─ streams: token events → pendingAssistant.content             │
       └─ done event → fetch final message → setMessages()             │
                                                                        │
useConnections ── connectionsApi.list() ──► /api/v1/connections        │
useSuggestedPrompts ── connectionsApi.getSchema() ──► /api/v1/connections/:id/schema
```

#### Communication protocol

All API calls use `Authorization: Bearer <jwt>`. The query pipeline uses **Server-Sent Events (SSE)** — the HTTP response is held open and events are flushed incrementally as each pipeline phase completes. This lets the UI update the timeline in real time and begin rendering the answer before the full summary is generated.

---

### Backend

**Stack:** Go 1.25, Gin, pgx/v5, sqlc, golang-migrate

#### Module layout

```
backend/
├── cmd/api/main.go          — server bootstrap, middleware wiring, graceful shutdown
└── internal/
    ├── database/
    │   ├── schema.sql       — single source of truth for the schema
    │   ├── query.sql        — sqlc input queries
    │   ├── migrations/      — versioned SQL migration files
    │   └── store/           — sqlc-generated type-safe query functions
    ├── middlewares/
    │   ├── auth.go          — JWT validation, injects user UUID into context
    │   ├── ratelimit.go     — per-IP fixed-window rate limiter
    │   ├── security.go      — HTTP security headers (HSTS, CSP, etc.)
    │   ├── logger.go        — structured JSON request logging (slog)
    │   └── error.go         — centralised error response formatting
    └── modules/
        ├── auth/            — register, login, OTP, refresh, logout
        ├── profile/         — user profile read/update
        ├── connection/      — DB connections CRUD, probe, schema introspection
        ├── apikey/          — BYOK API key management
        ├── security/        — password change, session management
        └── conversation/    — query pipeline, SSE stream handler
```

#### Rate limits

| Route group | Limit | Window |
|---|---|---|
| Auth (`/signin`, `/signup`, OTP) | 10 requests | 1 minute |
| General API | 120 requests | 1 minute |
| Query / AI pipeline | 30 requests | 1 minute |

---

### Database

**PostgreSQL 16** — single instance, schema managed by golang-migrate.

```
users
  └─► workspaces (1:1)
  └─► sessions  (1:N)  ──► refresh_tokens (1:N, rotating)
  └─► otps      (1:N, one active per type)
  └─► connections (1:N) ──► conversations (1:N) ──► messages (1:N)
  └─► api_keys  (1:1 active per user)
```

Key design choices:
- **`CITEXT`** on `users.email` — case-insensitive unique constraint without extra indexes
- **Partial unique index** on `otps(user_id, type) WHERE consumed = FALSE` — one active OTP per type, enforced at the DB level
- **Partial unique index** on `api_keys(user_id) WHERE is_active = TRUE` — one active key per user
- **AES-256 encryption** on `connections.password_encrypted` and `api_keys.key_encrypted` — envelope encrypted, key from `ENCRYPTION_KEY` env var
- **JSONB** for `messages.result_data` and `messages.interpretation` — flexible schema for query results and model annotations
- **`updated_at` triggers** on every mutable table — automatic timestamp management

---

### Query Pipeline — the core flow

This is what happens between the user pressing Enter and receiving an answer.

```
User types: "How did weekly signups change over the last 30 days?"
                              │
                              ▼
               ┌──────────────────────────┐
               │   1. Load dependencies   │
               │  • Verify conversation   │
               │  • Decrypt DB password   │
               │  • Resolve LLM client    │  ◄── GEMINI_API_KEY (system default)
               │  • Introspect DB schema  │      or user BYOK key
               │    (cached 10 min)       │
               │  • Load last 10 msgs     │
               └──────────────┬───────────┘
                              │
                    SSE event: step → "parsing"
                              │
                              ▼
               ┌──────────────────────────┐
               │   2. Generate SQL        │
               │  • System prompt injects │
               │    full DB schema        │
               │  • Conversation history  │
               │    provides context      │
               │  • LLM returns JSON:     │
               │    { sql, interpretation }│
               └──────────────┬───────────┘
                              │
                    SSE event: step → "sql_ready"
                              │
                              ▼
               ┌──────────────────────────┐
               │   3. Guardrail validate  │
               │  • SQL parser checks     │
               │    statement type        │
               │  • MUST be SELECT only   │
               │  • Blocks: INSERT/UPDATE │
               │    DELETE/DROP/TRUNCATE  │
               │    and any DDL           │
               └──────────────┬───────────┘
                              │
                    SSE event: step → "validated"
                              │
                              ▼
               ┌──────────────────────────┐
               │   4. Execute query       │
               │  • Opens connection to   │
               │    user's database       │
               │  • Runs SELECT with      │
               │    statement timeout     │
               │  • Result cached 5 min   │
               │    (keyed by conn+SQL)   │
               └──────────────┬───────────┘
                              │
                    SSE event: step → "executed" (rows, cols, cached)
                              │
                              ▼
               ┌──────────────────────────┐
               │   5. Stream summary      │
               │  • LLM receives:         │
               │    question + result JSON│
               │  • Streams tokens back   │
               │    as they are generated │
               └──────────────┬───────────┘
                              │
               SSE events: token → "The number of weekly..." (per token)
                              │
                              ▼
               ┌──────────────────────────┐
               │   6. Persist & close     │
               │  • Save assistant message│
               │    with SQL, result,     │
               │    interpretation, timing│
               │  • Emit: done {messageId}│
               └──────────────────────────┘
```

The frontend receives each SSE event in real time:
- **`step`** events update the Timeline panel as each phase completes
- **`token`** events stream the natural-language summary word by word
- **`done`** triggers a final fetch to get the fully-persisted message
- **`error`** at any phase surfaces a human-readable error to the user

---

## Security Architecture

| Layer | Mechanism |
|---|---|
| Transport | HTTPS enforced via HSTS (`max-age=63072000`) |
| Authentication | Short-lived JWT access tokens + rotating refresh tokens (per-device sessions) |
| Credential storage | AES-256 envelope encryption for DB passwords and API keys |
| SQL guardrails | Server-side parse of every generated query; non-SELECT blocked unconditionally |
| Rate limiting | Per-IP fixed-window: 10/min auth, 120/min API, 30/min AI pipeline |
| HTTP headers | `X-Content-Type-Options`, `X-Frame-Options: DENY`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy` |
| Process isolation | Container runs as non-root `simbo` user; `no-new-privileges` security option |
| OTP integrity | One-active-per-type enforced at DB level via partial unique index |
| Session revocation | Sessions and refresh tokens can be individually revoked; token rotation on every refresh |

---

## Deployment Architecture

### Infrastructure

```
                        Internet
                           │
                           ▼
               ┌───────────────────────┐
               │    VM  (Linux)        │
               │    e.g. Hetzner CX21  │
               │    Ubuntu 22.04 LTS   │
               │                       │
               │  ┌─────────────────┐  │
               │  │   Nginx         │  │  ◄── SSL termination (Let's Encrypt)
               │  │  :80  → :443    │  │      Reverse proxy to app container
               │  │  :443 → :3000   │  │
               │  └────────┬────────┘  │
               │           │           │
               │  ┌────────▼────────┐  │
               │  │  Docker Compose │  │
               │  │                 │  │
               │  │  ┌───────────┐  │  │
               │  │  │  app      │  │  │  ← Next.js :3000 + Go API :9090
               │  │  │  container│  │  │    Single image, two processes
               │  │  │  (simbo)  │  │  │    managed by supervisord
               │  │  └───────────┘  │  │
               │  │  ┌───────────┐  │  │
               │  │  │  db       │  │  │  ← PostgreSQL 16 Alpine
               │  │  │  container│  │  │    Data on named volume
               │  │  │ (postgres)│  │  │    Bound to 127.0.0.1 only
               │  │  └───────────┘  │  │
               │  └─────────────────┘  │
               └───────────────────────┘
```

Two VMs are provisioned — one for **production**, one for **staging** — running identical Docker Compose stacks with environment-specific secrets.

### Container Layout

#### `app` container — Next.js + Go in one image

The Dockerfile is a three-stage build:

```
Stage 1: node:20-alpine   → npm ci + next build → .next/standalone
Stage 2: golang:1.25-alpine → go build → statically-linked binary
Stage 3: node:20-alpine   → copy binary + Next.js bundle + supervisord
```

At runtime, **supervisord** manages two processes inside the same container:

| Process | Command | Port | Start order |
|---|---|---|---|
| `backend` | `/app/api` | 9090 | Priority 10 (first) |
| `frontend` | `node /app/frontend/server.js` | 3000 | Priority 20 (after backend) |

Both processes run as the non-root `simbo` user. supervisord itself runs as root solely to fork child processes, then drops privileges.

#### `db` container — PostgreSQL 16 Alpine

- Data persisted on a named Docker volume (`postgres_data`)
- Exposed only on `127.0.0.1:5432` — not reachable from outside the VM
- Schema migrations run automatically at Go API startup via golang-migrate

#### Resource limits

| Container | Memory limit | CPU limit |
|---|---|---|
| app | 768 MB | 1.5 cores |
| db | 512 MB | 1.0 core |

---

### CI/CD Pipeline

```
Developer pushes code
        │
        ├── branch: main ──────────► Production deploy
        └── branch: staging ───────► Staging deploy

GitHub Actions workflow (per environment):

  1. Checkout code
  2. Set up Docker Buildx
  3. Build image
       docker build \
         --build-arg NEXT_PUBLIC_API_URL=https://api.yourdomain.com \
         -t ghcr.io/your-org/simbo:$SHA \
         -f deployments/docker/Dockerfile .
  4. Push to GitHub Container Registry (GHCR)
  5. SSH into target VM
  6. Pull new image
       docker pull ghcr.io/your-org/simbo:$SHA
  7. Rolling deploy
       docker compose pull
       docker compose up -d --no-deps app
  8. Health check
       wget -qO- http://localhost:9090/healthz
  9. Notify (Slack / email) on failure
```

**Secrets** are stored as GitHub Actions environment secrets and injected at deploy time — never committed to the repository.

**Environment promotion:** Changes go to `staging` first for smoke-testing, then merged to `main` for production. Database migrations run automatically on startup, so schema changes are applied before the new code accepts traffic.

---

## Local Development

### Prerequisites

- Go 1.25+
- Node.js 20+
- PostgreSQL 16 (or `docker compose up db`)
- A Gemini API key (free tier at [aistudio.google.com](https://aistudio.google.com))

### Setup

```bash
# Clone
git clone https://github.com/your-org/simbo
cd simbo

# Backend — copy and fill in the env file
cp backend/.env.example backend/.env
# Edit backend/.env: set DATABASE_URL, JWT_ACCESS_SECRET, ENCRYPTION_KEY, GEMINI_API_KEY

# Start the database only
cd deployments/docker
docker compose up db -d

# Run migrations + start the API
cd ../../backend/cmd/api
go run .

# In a separate terminal — start the frontend
cd frontend
npm install
npm run dev
```

Frontend: http://localhost:3000  
API: http://localhost:9090  
Health: http://localhost:9090/healthz

### Running the full stack with Docker

```bash
cd deployments/docker
cp ../../backend/.env.example .env   # fill in values
docker compose up --build
```

---

## License

MIT. Use it, fork it, ship something better.
