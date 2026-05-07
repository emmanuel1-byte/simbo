# Simbo

**Talk to your database like a person.** Read-only by design.

Simbo turns plain-English questions ("how did weekly signups change last month?") into safe, validated SQL, runs it against your database, and hands you back the answer — with the SQL, the interpretation, and the execution timeline shown alongside, so engineers can verify what actually ran.

It's a tool for the people who keep asking analysts for numbers and the people who keep getting asked.

---

## Why Simbo exists

Most "ask your database" tools fall into one of two camps:

1. **Pretty chatbots** that hallucinate SQL, hide what ran, and make engineers nervous.
2. **Heavy BI suites** that take a week to set up and a quarter to onboard.

Simbo sits between them. It's opinionated about three things:

- **Read-only or nothing.** Every generated query is parsed and re-validated server-side before it ever touches your database. `INSERT`, `UPDATE`, `DELETE`, `DROP`, `TRUNCATE` — all blocked at the engine, not just the prompt. Connect through a read-replica role and the guardrails compound.
- **Show your work.** The right-hand inspector exposes the model's interpretation, the exact SQL, and a step-by-step execution timeline (parse → generate → validate → execute → summarize). Engineers don't have to trust the answer — they can read it.
- **Bring your own key.** Simbo doesn't ship its own LLM. You connect OpenAI, Anthropic, or Gemini. Keys are encrypted at rest with AES-256 envelope encryption, per-user. Prompt and response bodies are never logged.

That's the whole pitch. The rest is execution.

---

## What it does

- Natural-language Q&A over Postgres, MySQL, and Snowflake (more on the way)
- Two-pass SQL generation validated against `information_schema` before execution
- Hard guardrails: write-blocking, query timeouts, heavy-scan warnings (>1M rows), optional PII redaction
- Voice or text input
- Results as chart, table, or summary — with surfaced anomalies and follow-up suggestions
- Workspaces, history, saved queries, sharing, exports
- Audit log of every query and decision

## Status

Active development.

---

## License

MIT. Use it, fork it, ship something better.