# Simbo

> Ask your database questions in plain English. Get the answer, the SQL, and the full execution timeline.

This is a side project I built, and as backend engineers we all know how daunting writing SQL can get sometimes, especially when you are dealing with complex queries involving multiple tables, joins, aggregations, and heavy data retrieval. Most times you even have to stop and look up the correct syntax.

So I started thinking about a different approach. What if instead of writing SQL by hand, you could simply ask your database a question or use a voice command and get back the answer, the SQL that ran, the interpreted intent, and a complete execution timeline?

That idea became **Simbo**.

It also works great for PMs and non-technical users who need answers from data without having to learn SQL or wait on a developer.

I learned a lot while building it and I still use it regularly.

One important thing: it never writes to your database. Read only, always.


## What you get

- **Plain English queries** — type or speak your question
- **Voice input** — use your microphone instead of typing
- **Generated SQL** — see exactly what ran against your database
- **Intent parsing** — Simbo shows how it interpreted your question
- **Execution timeline** — every step is visible, nothing is a black box
- **Read only enforcement**, anything that is not a SELECT is blocked before it gets near your data
- **Bring your own AI key**, works with Gemini out of the box, or plug in your OpenAI or Anthropic key
- **Encrypted at rest**, both your database passwords and AI API keys are AES-256 encrypted before being stored


## How it works

```
You type or speak a question
            ↓
Simbo reads your database schema
            ↓
Sends the schema and your question to an AI
            ↓
AI generates the SQL
            ↓
Simbo validates it (non-SELECT queries are blocked)
            ↓
Runs the query against your database
            ↓
Streams back the answer, the SQL, and the timeline
```


## Architecture

```
Browser (Next.js)
        ↓
Go API  (auth, connections, conversations, streaming)
    ↓                       ↓
Your Database           AI Provider
Postgres, MySQL,        Gemini / OpenAI
Snowflake, BigQuery     / Anthropic

Simbo's own Postgres
(users, sessions, connections, conversations, messages)
```


## Tech stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Frontend  | Next.js 14, TypeScript, Tailwind CSS |
| Backend   | Go, Gin, sqlc                       |
| Database  | PostgreSQL                          |
| AI        | Gemini (default), OpenAI, Anthropic |
| Auth      | JWT with refresh tokens             |
| Deploy    | Docker Compose                      |


## Running locally

Copy the example env file and fill in your values:

```bash
cp backend/.env.example backend/.env
```

**Option 1: Docker (easiest)**

```bash
cd deployments/docker
docker compose up --build
```

**Option 2: Run each piece separately**

```bash
# Start the database
cd deployments/docker && docker compose up db -d

# Start the API
cd backend/cmd/api && go run .

# Start the frontend
cd frontend && npm install && npm run dev
```

Frontend runs at `localhost:3000` and the API at `localhost:9090`.


## Environment variables

Copy `backend/.env.example` to `backend/.env` and set these:

| Variable         | Description                              |
|------------------|------------------------------------------|
| `DATABASE_URL`   | Postgres connection string               |
| `JWT_ACCESS_SECRET` | Secret for signing access tokens      |
| `ENCRYPTION_KEY` | Key used to encrypt saved DB passwords and AI API keys |
| `GEMINI_API_KEY` | Default AI provider (free tier works)    |
| `USEPLUNK_PUBLIC_KEY` | For transactional emails (optional) |
