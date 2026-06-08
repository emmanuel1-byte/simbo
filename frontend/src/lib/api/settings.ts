/**
 * Settings-related API resources: DB connections and AI provider key.
 *
 * Backend endpoints (all under /api/v1):
 *   GET    /connections                    → DbConnection[]
 *   POST   /connections                    → DbConnection
 *   POST   /connections/probe              → { message, tableCount }
 *   POST   /connections/:id/test           → { message, tableCount }
 *   DELETE /connections/:id                → { message }
 *
 *   GET    /settings/api-key               → ApiKeyMeta | null (404 when absent)
 *   POST   /settings/api-key               → ApiKeyMeta
 *   POST   /settings/api-key/test          → { message, provider, model }
 *   PUT    /settings/api-key/rotate        → ApiKeyMeta
 *   DELETE /settings/api-key               → { message }
 *
 * Field mapping: the backend uses snake_case; we map to the frontend camelCase
 * types in this layer so UI components never need to know about `db_type` etc.
 */

import { http, unwrap } from './http';
import type { AiProvider, ApiKeyMeta, CreateConnectionPayload, DbConnection, DbProvider } from '@/types';

// ─── Connection field mapping ─────────────────────────────

interface BackendConnection {
  id: string;
  name: string;
  db_type: string;
  host: string;
  port: number;
  database_name: string;
  use_tls: boolean;
  status: 'connected' | 'pending' | 'error';
  table_count: number;
  last_synced_at?: string | null;
  created_at: string;
}

function mapConnection(c: BackendConnection): DbConnection {
  return {
    id: c.id,
    name: c.name,
    provider: c.db_type as DbProvider,
    host: c.host,
    port: c.port,
    database: c.database_name,
    useTls: c.use_tls,
    status: c.status,
    tableCount: c.table_count ?? 0,
    lastSyncedAt: c.last_synced_at ?? undefined,
    createdAt: c.created_at,
  };
}

function toBackendPayload(payload: CreateConnectionPayload) {
  return {
    name: payload.name,
    db_type: payload.provider,
    host: payload.host,
    port: payload.port ?? 5432,
    database_name: payload.database,
    username: payload.username,
    password: payload.password,
    use_tls: payload.ssl,
  };
}

// ─── API key field mapping ────────────────────────────────

interface BackendApiKey {
  id: string;
  provider: string;
  model: string;
  keyHint: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

function mapApiKey(k: BackendApiKey): ApiKeyMeta {
  return {
    id: k.id,
    provider: k.provider as AiProvider,
    model: k.model,
    keyHint: k.keyHint,
    isActive: k.isActive,
    lastUsedAt: k.lastUsedAt,
    createdAt: k.createdAt,
  };
}

// ─── Connections API ──────────────────────────────────────

export const connectionsApi = {
  async list(): Promise<DbConnection[]> {
    const rows = await unwrap<BackendConnection[]>(http.get('/connections'));
    return rows.map(mapConnection);
  },

  async probe(
    payload: CreateConnectionPayload,
  ): Promise<{ ok: boolean; tableCount?: number; error?: string }> {
    try {
      const data = await unwrap<{ message: string; tableCount: number }>(
        http.post('/connections/probe', toBackendPayload(payload)),
      );
      return { ok: true, tableCount: data.tableCount };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      return { ok: false, error: msg };
    }
  },

  async create(payload: CreateConnectionPayload): Promise<DbConnection> {
    const conn = await unwrap<BackendConnection>(http.post('/connections', toBackendPayload(payload)));
    return mapConnection(conn);
  },

  async test(id: string): Promise<{ ok: boolean; tableCount?: number }> {
    const data = await unwrap<{ message: string; tableCount: number }>(
      http.post(`/connections/${id}/test`),
    );
    return { ok: true, tableCount: data.tableCount };
  },

  async remove(id: string): Promise<void> {
    await unwrap<{ message: string }>(http.delete(`/connections/${id}`));
  },

  async getTables(id: string): Promise<string[]> {
    const data = await unwrap<{ tables: string[] }>(http.get(`/connections/${id}/tables`));
    return data.tables ?? [];
  },

  async getSchema(id: string): Promise<{ name: string; columns: { name: string; type: string; nullable: boolean }[] }[]> {
    const data = await unwrap<{ tables: { name: string; columns: { name: string; type: string; nullable: boolean }[] }[] }>(
      http.get(`/connections/${id}/schema`),
    );
    return data.tables ?? [];
  },
};

// ─── API Key API ──────────────────────────────────────────

export const apiKeyApi = {
  async get(): Promise<ApiKeyMeta | null> {
    try {
      const k = await unwrap<BackendApiKey>(http.get('/settings/api-key'));
      return mapApiKey(k);
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 404) return null;
      throw err;
    }
  },

  async save(provider: AiProvider, model: string, key: string): Promise<ApiKeyMeta> {
    const k = await unwrap<BackendApiKey>(http.post('/settings/api-key', { provider, model, key }));
    return mapApiKey(k);
  },

  async test(): Promise<{ ok: boolean; provider: string; model: string }> {
    const data = await unwrap<{ message: string; provider: string; model: string }>(
      http.post('/settings/api-key/test'),
    );
    return { ok: true, provider: data.provider, model: data.model };
  },

  async rotate(key: string, model: string): Promise<ApiKeyMeta> {
    const k = await unwrap<BackendApiKey>(http.put('/settings/api-key/rotate', { key, model }));
    return mapApiKey(k);
  },

  async revoke(): Promise<void> {
    await unwrap<{ message: string }>(http.delete('/settings/api-key'));
  },
};
