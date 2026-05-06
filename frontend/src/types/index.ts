// ────────────────────────────────────────────────────────────
// Core domain types — kept aligned with the NestJS backend.
// Edit here when the BE schema evolves.
// ────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'analyst' | 'viewer' | 'guest';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  role: UserRole;
  emailVerified: boolean;
  workspaceId: string;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // unix seconds
}

export type DbProvider = 'postgres' | 'mysql' | 'snowflake' | 'bigquery' | 'sqlite';

export interface DbConnection {
  id: string;
  name: string;
  provider: DbProvider;
  host: string;
  database: string;
  port?: number;
  isReadOnly: boolean;
  status: 'connected' | 'pending' | 'error';
  tablesCount?: number;
  lastSyncAt?: string;
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

export type AiProvider = 'openai' | 'anthropic' | 'google';

export interface ApiKeyMeta {
  id: string;
  provider: AiProvider;
  model: string;
  lastFour: string;
  status: 'valid' | 'invalid' | 'untested';
  addedAt: string;
  lastUsedAt?: string | null;
}

// ─── Queries / Chat ────────────────────────────────────────

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

export interface ResultRow {
  [key: string]: string | number | boolean | null;
}

export interface QueryResult {
  columns: string[];
  rows: ResultRow[];
  rowCount: number;
  executionMs: number;
  cached?: boolean;
}

export interface InterpretedIntent {
  description: string;
  entities: Array<{ kind: 'table' | 'filter' | 'agg' | 'group' | 'range'; label: string }>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  // Assistant-only metadata:
  intent?: InterpretedIntent;
  sql?: string;
  result?: QueryResult;
  steps?: ExecutionStep[];
  status?: QueryStatus;
  errorMessage?: string;
}

export interface Conversation {
  id: string;
  title: string;
  connectionId: string;
  messages: ChatMessage[];
  pinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── API envelope ──────────────────────────────────────────

export interface ApiSuccess<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  message: string;
  code?: string;
  fieldErrors?: Record<string, string>;
  status?: number;
}
