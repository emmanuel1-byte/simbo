# Simbo

Ask your database questions in plain English. Simbo generates the SQL, validates it, runs it, and explains what it found — with the query and execution timeline right there so you can verify everything.

Read-only by design. No write operations ever reach your database.

---

## How it works

You type a question. Simbo:

1. Pulls your database schema (cached)
2. Sends the schema + question to an LLM to generate SQL
3. Validates the SQL server-side — anything that isn't a `SELECT` is blocked before it gets near your database
4. Runs the query against your connected database
5. Streams a plain-English summary back to you, token by token
6. Shows you the SQL, interpretation, and execution timeline inline so you can see exactly what ran

Each step is visible in the chat — you're never just trusting a black box.

---

## Stack

**Frontend** — Next.js 14, TypeScript, Tailwind CSS  
**Backend** — Go, Gin, PostgreSQL, sqlc  
**LLM** — Gemini by default (via `GEMINI_API_KEY`), or bring your own OpenAI / Anthropic key  

---

## Architecture

```
Browser (Next.js)
    │
    │  REST + SSE
    ▼
Go API (Gin)
    ├── auth, profile, connections, api-keys
    └── conversation pipeline (SSE stream)
            │
            ├── LLM  (Gemini / OpenAI / Anthropic)
            └── User's database (Postgres, MySQL, Snowflake)

PostgreSQL (Simbo's own DB)
    — users, sessions, connections, conversations, messages
```

The query pipeline streams events back to the browser as each phase completes, so the timeline updates live while the query is running.

---

## Deployment

Two environments — production and staging — each running on a single VM.

```
VM (Ubuntu)
└── Nginx  (SSL termination, reverse proxy)
    └── Docker Compose
        ├── app container  — Next.js + Go API (supervisord manages both processes)
        └── db container   — PostgreSQL 16
```

The frontend and backend share one Docker image, built in three stages (Node builder → Go builder → Node runtime). supervisord starts the Go API first, then Next.js.

### CI/CD

Push to `staging` → deploys to the staging VM.  
Push to `main` → deploys to production.

GitHub Actions builds the image, pushes it to GHCR, SSHs into the target VM, and does a rolling update. Migrations run automatically at startup.

---

## Running locally

```bash
# Copy and fill in the env file
cp backend/.env.example backend/.env

# Start Postgres
cd deployments/docker && docker compose up db -d

# Start the API (from backend/cmd/api)
go run .

# Start the frontend
cd frontend && npm install && npm run dev
```

Or run the whole thing with Docker:

```bash
cd deployments/docker
docker compose up --build
```

Frontend at `localhost:3000`, API at `localhost:9090`.

---

## License

MIT.
