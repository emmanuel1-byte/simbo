# Simbo — Frontend

Natural-language database queries. Next.js 14 App Router, TypeScript, Tailwind.

The FE is **fully functional with mock data** out of the box. Flip one env flag to point it at the NestJS backend.

---

## Quick start

```bash
# 1. Install
npm install

# 2. Start dev server (uses mocks by default)
npm run dev

# 3. Open
open http://localhost:3000
```

You'll land on the **public landing page**. With mocks on:

- **Sign up** with any email + password (must hit the strength rules).
- **OTP verification**: the demo code is `123456` (shown inline on the screen).
- **Sign in**: any email + a password ≥ 6 chars.
- **Voice input**: hit the Voice toggle in the ask box. Works in Chrome, Edge, Safari.
- **Add connection**: try `bad-host.com` to see a failure state, anything else passes.

---

## Pointing the FE at the real backend

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_USE_MOCKS=false
```

Once `NEXT_PUBLIC_USE_MOCKS=false`, every call goes through `src/lib/api/http.ts` — an axios instance that:

- attaches `Authorization: Bearer <token>` from `localStorage`,
- normalizes errors into `ApiError`,
- redirects to `/signin?next=…` on 401.

---

## Backend contract (what NestJS needs to expose)

All endpoints expect/return JSON enveloped as `{ data: T, message?: string }`. Errors:
`{ message: string, code?: string, fieldErrors?: { [field]: string } }`.

### Auth

| Method | Path                      | Body                                     | Returns                                |
| ------ | ------------------------- | ---------------------------------------- | -------------------------------------- |
| POST   | `/auth/signup`            | `{ name, email, password }`              | `{ email, otpSent: true }`             |
| POST   | `/auth/verify-otp`        | `{ email, code }`                        | `{ tokens, user }`                     |
| POST   | `/auth/resend-otp`        | `{ email }`                              | `{ sent: true, cooldownSec: number }`  |
| POST   | `/auth/login`             | `{ email, password }`                    | `{ tokens, user }`                     |
| POST   | `/auth/forgot-password`   | `{ email }`                              | `{ sent: true, cooldownSec: number }`  |
| POST   | `/auth/reset-password`    | `{ email, code, password }`              | `{ ok: true }`                         |
| POST   | `/auth/refresh`           | `{ refreshToken }`                       | `{ tokens }`                           |
| GET    | `/auth/me`                | —                                        | `User`                                 |
| POST   | `/auth/logout`            | —                                        | `{ ok: true }`                         |

`tokens = { accessToken, refreshToken, expiresAt }` where `expiresAt` is unix seconds.

### Queries / Conversations

| Method | Path                                  | Body                                      | Returns                              |
| ------ | ------------------------------------- | ----------------------------------------- | ------------------------------------ |
| POST   | `/queries/ask`                        | `{ prompt, connectionId, conversationId? }` | **SSE stream** of `step` + `message` events |
| GET    | `/conversations`                      | —                                         | `Conversation[]`                     |
| GET    | `/conversations/:id`                  | —                                         | `Conversation`                       |
| DELETE | `/conversations/:id`                  | —                                         | `{ ok: true }`                       |
| POST   | `/conversations/:id/messages`         | `{ prompt }`                              | `ChatMessage` (assistant)            |

**Streaming `/queries/ask`** — the mock generator yields events shaped like:

```ts
type AskEvent =
  | { type: 'step'; step: ExecutionStep }
  | { type: 'message'; message: ChatMessage }
  | { type: 'error'; error: string };
```

When the backend is ready, replace the generator body in `src/lib/api/queries.ts` (the `ask` method) with an SSE/WebSocket consumer. The hook `useAskFlow` and the chat page don't change — they just consume the same generator.

### Connections

| Method | Path                              | Body                                   | Returns                                       |
| ------ | --------------------------------- | -------------------------------------- | --------------------------------------------- |
| GET    | `/connections`                    | —                                      | `DbConnection[]`                              |
| POST   | `/connections`                    | `CreateConnectionPayload`              | `DbConnection`                                |
| POST   | `/connections/test-credentials`   | `CreateConnectionPayload`              | `{ ok, latencyMs, tablesCount?, error? }`     |
| POST   | `/connections/:id/test`           | —                                      | `{ ok: boolean, latencyMs: number }`          |
| DELETE | `/connections/:id`                | —                                      | `{ ok: true }`                                |

Note: `test-credentials` validates **before** save, so the user can verify the connection works without committing credentials yet. The store-then-test pattern is also supported via `:id/test`.

### API key

| Method | Path                          | Body                       | Returns                                       |
| ------ | ----------------------------- | -------------------------- | --------------------------------------------- |
| GET    | `/api-key`                    | —                          | `ApiKeyMeta \| null`                          |
| POST   | `/api-key`                    | `{ provider, key }`        | `ApiKeyMeta`                                  |
| POST   | `/api-key/test`               | —                          | `{ ok: boolean, latencyMs: number, model }`   |
| DELETE | `/api-key`                    | —                          | `{ ok: true }`                                |

All domain types live in `src/types/index.ts` — keep this file in sync with the BE schema.

---

## Project structure

```
src/
  app/
    page.tsx                   PUBLIC LANDING PAGE
    layout.tsx                 Root: fonts, providers, toaster
    not-found.tsx              On-brand 404
    globals.css                Tailwind + custom utilities
    (auth)/                    Sign in, sign up, OTP, forgot, reset
      layout.tsx               Split poster + form chrome
    (app)/                     Protected routes
      layout.tsx               Auth guard + AppShell
      ask/                     Home / query hub (with onboarding banner)
      chat/[id]/               Two-column chat workspace
      history/                 Conversations list
      settings/
        layout.tsx             Side-nav for settings
        profile/
        security/
        connections/           with Add Connection modal
        api-key/

  components/
    ui/                        Button, Input, OtpInput, Pill, Modal, ConfirmDialog, Skeleton, etc.
    auth/                      Auth-specific (header, OAuth button)
    app/                       App shell (rail, topbar, ask box, command palette,
                                          add-connection modal, account menu)
    chat/                      ChatThread, Inspector, SqlHighlight
    results/                   AnswerCard, ResultTable
    empty-states/              EmptyState + 5 bespoke SVG illustrations
    icons/                     Hand-rolled icon set

  contexts/
    auth-context.tsx           Auth state + login/logout helpers

  lib/
    api/                       Axios + resource modules (auth, queries, settings)
    data/mocks.ts              Rich mock data
    hooks/                     useAskFlow, useConnections, useVoiceInput,
                               useCommandShortcut, useOnboardingState
    utils/                     cn, format, token storage
    validators/                Zod schemas (auth, connection)

  types/
    index.ts                   Single source of truth for domain types
```

---

## Routing map

```
/                              Public landing page
/signin                        Sign in (with ?next= preserve)
/signup                        Sign up
/verify-otp                    OTP entry (intent=verify | reset)
/forgot-password               Request reset code
/reset-password                Set new password

/ask                           Home / query hub  (PROTECTED)
/chat/[id]                     Two-column workspace
/history                       Past conversations
/settings/profile              Account
/settings/security             Read-only guardrails
/settings/connections          DB connections (?new=1 auto-opens modal)
/settings/api-key              AI provider key
```

---

## Auth flow

```
/signup ──→ /verify-otp ──→ /ask
                ▲
                │
/forgot-password ──→ /verify-otp?intent=reset ──→ /reset-password ──→ /signin ──→ /ask
```

The OTP screen handles both verification _and_ password-reset code entry via the `intent` query param.

The auth context:

1. On mount, reads tokens from `localStorage` and calls `/auth/me`.
2. Status machine: `idle → loading → authenticated | unauthenticated`.
3. `<ProtectedRoute>` renders a brand-loading state while `loading`, redirects on `unauthenticated`.

When you switch to httpOnly cookies, change `src/lib/utils/token-storage.ts` only — call sites stay identical.

---

## Onboarding behaviour

When a user lands on `/ask`, the `useOnboardingState` hook checks whether they have:

1. An AI provider key configured.
2. At least one connected database.

If either is missing, an inline banner surfaces above the hero with `step 01/02` or `step 02/02` and a CTA that opens the right setup screen (or the Add Connection modal directly). New users never hit a dead end with a query input that doesn't actually work.

---

## Voice input

`useVoiceInput` wraps the **Web Speech API** (browser-native, no SDK).

- Feature-detected — falls back to a friendly toast if unsupported.
- Continuous + interim results — transcript streams into the input as the user speaks.
- Permission states: `idle | listening | denied | unsupported | error`.
- Animated bar visualizer while listening; the box border pulses accent.

Browser support: Chrome / Edge / Safari (full); Firefox limited (behind a flag in many builds).

To swap to a server-side STT later (e.g. Whisper), keep the same hook signature — just replace its body.

---

## Command palette (⌘K)

Press <kbd>⌘ K</kbd> (or <kbd>Ctrl K</kbd>) anywhere in the app to open a fuzzy nav:

- Go to: Ask, History
- Settings: Profile, Connections, API key, Security
- Actions: Add new connection
- Recent queries (last 8)

Arrow keys navigate, Enter to select, Esc to close.

---

## Mobile

- Rail collapses to a slide-in drawer triggered from a top hamburger.
- Floating "Ask" FAB on mobile.
- Two-column chat collapses to a stacked layout (inspector hidden < lg).
- Auth, settings, history, ask all touch-friendly.

---

## Things deliberately left as TODOs

These are placeholders in the FE — wire when ready:

1. **OAuth (Google).** `src/components/auth/oauth-button.tsx` shows a toast. Replace with `window.location.href = ${API}/auth/google`.
2. **Profile patch endpoint.** `PATCH /auth/me` isn't defined yet — the profile form just toasts.
3. **Profile photo upload.** Button placeholder; needs a multipart endpoint.
4. **Audit log page.** Linked from `/settings/security` but not built.
5. **Real STT fallback.** Web Speech API works; server-side whisper-style STT can be plugged into `useVoiceInput` later.

---

## Design system

Three typefaces, intentionally:

- **JetBrains Mono** — UI labels, code, metadata. The "technical" voice.
- **Fraunces** (italic) — hero moments, answers, accents. The "editorial" voice.
- **IBM Plex Sans** — body. Quiet, neutral.

Single accent color: **electric lime (`#d3ff3a`)** on deep ink (`#0a0b0a`). All other colors are neutrals.

Tokens are in `tailwind.config.ts` — extend there, not inline.

---

## Scripts

```bash
npm run dev        # Dev server
npm run build      # Production build
npm run start      # Run production build
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit (run this in CI)
```

---

## Notes for the BE engineer

- **Errors:** if the BE returns `fieldErrors`, the auth forms will display them per-field via React Hook Form's `setError`. Keep the keys aligned with form field names (`email`, `password`, `name`, `code`).
- **CORS:** dev FE runs on `:3000`, dev BE on `:4000`. Allow credentials + the `Authorization` header.
- **Tokens:** the FE expects `expiresAt` as unix seconds, not ms. Don't ship `Date` objects — stringify ISO or use numbers consistently.
- **OTP UX:** the FE auto-submits as soon as the user types the 6th digit. Make sure your verify endpoint handles slightly racy double-submits gracefully (or returns a stable error code).
- **Streaming:** if SSE is too heavy for v1, you can return a single `message` event from `/queries/ask` and the FE will still render correctly — the timeline will just appear all at once instead of progressively.
- **Test-before-save:** the Add Connection modal hits `/connections/test-credentials` with the full form payload, not a saved connection ID. Make sure that endpoint accepts the same DTO as create — minus what the server would generate.
- **Read-only enforcement:** the FE shows a SAFE MODE pill prominently. If the BE refuses a write on the server, return a `403` with `code: 'SAFE_MODE'` and the FE will surface it cleanly via the toaster.

---

Built with care. Ship with care.
