// ────────────────────────────────────────────────────────────
// Core domain types — kept aligned with the Go backend.
// ────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string; // mapped from backend `fullname`
  verified: boolean;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number; // unix seconds, computed client-side
}

// ─── Database Connections ──────────────────────────────────

export type DbProvider = 'postgres' | 'mysql' | 'snowflake' | 'bigquery' | 'sqlite';

export interface DbConnection {
  id: string;
  name: string;
  provider: DbProvider;    // mapped from backend `db_type`
  host: string;
  database: string;        // mapped from backend `database_name`
  port: number;
  useTls: boolean;         // mapped from backend `use_tls`
  status: 'connected' | 'pending' | 'error';
  tableCount: number;      // mapped from backend `table_count`
  lastSyncedAt?: string;   // mapped from backend `last_synced_at`
  createdAt: string;
}

export interface CreateConnectionPayload {
  name: string;
  provider: DbProvider;
  host: string;
  port?: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
}

// ─── AI Provider / API Keys ────────────────────────────────

export type AiProvider = 'openai' | 'anthropic';

export interface ApiKeyMeta {
  id: string;
  provider: AiProvider;
  model: string;
  keyHint: string;         // "····{last4}" — from backend `key_hint`
  isActive: boolean;
  createdAt: string;
  lastUsedAt?: string | null;
}

// ─── Conversations & Messages ──────────────────────────────

export interface Conversation {
  id: string;
  connectionId: string;
  title: string;
  connectionName: string;
  connectionDbType: string;
  createdAt: string;
  updatedAt: string;
}

export type MessageRole = 'user' | 'assistant';

export interface MessageInterpretation {
  summary: string;
  tags: Array<{ type: string; value: string }>;
}

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  rowCount?: number;
  executionMs?: number;
  cached?: boolean;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  inputMode: 'text' | 'voice';
  createdAt: string;
  // assistant-only
  interpretation?: MessageInterpretation;
  sqlQuery?: string;
  executionTimeMs?: number;
  rowCount?: number;
  colCount?: number;
  result?: QueryResult;
  isCached: boolean;
  error?: string;
}

// ─── SSE stream events (from /conversations/:id/query) ────

export interface StepPayload {
  phase: string;
  ms: number;
  transcription?: string;
  interpretation?: MessageInterpretation;
  sql?: string;
  rows?: number;
  cols?: number;
  cached?: boolean;
  result?: QueryResult;
}

export interface DonePayload {
  messageId: string;
  totalMs: number;
}

export interface ErrorPayload {
  phase: string;
  message: string;
}

export type SSEEvent =
  | { kind: 'step'; data: StepPayload }
  | { kind: 'token'; data: string }
  | { kind: 'done'; data: DonePayload }
  | { kind: 'error'; data: ErrorPayload };

// ─── Legacy chat types (used by existing UI components) ───
// Kept for backward-compat with components that haven't migrated yet.

export type QueryStatus =
  | 'idle'
  | 'parsing'
  | 'generating'
  | 'validating'
  | 'executing'
  | 'summarizing'
  | 'done'
  | 'failed';

export interface ExecutionStep {
  id: string;
  label: string;
  description?: string;
  durationMs?: number;
  status: 'done' | 'running' | 'pending' | 'failed';
}

export interface InterpretedIntent {
  description: string;
  entities: Array<{ kind: 'table' | 'filter' | 'agg' | 'group' | 'range'; label: string }>;
}

export interface ResultRow {
  [key: string]: string | number | boolean | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  // assistant-only metadata
  intent?: InterpretedIntent;
  sql?: string;
  result?: QueryResult;
  steps?: ExecutionStep[];
  status?: QueryStatus;
  errorMessage?: string;
}

// ─── API envelope ──────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  fieldErrors?: Record<string, string>;
}
