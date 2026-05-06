/**
 * Settings-related API resources: DB connections, AI provider key, workspace.
 *
 * BACKEND CONTRACTS:
 *   GET    /connections                           → DbConnection[]
 *   POST   /connections                           → DbConnection
 *   DELETE /connections/:id                       → { ok: true }
 *   POST   /connections/:id/test                  → { ok: boolean, latencyMs: number }
 *
 *   GET    /api-key                               → ApiKeyMeta | null
 *   POST   /api-key   { provider, key }           → ApiKeyMeta
 *   POST   /api-key/test                          → { ok: boolean, latencyMs: number, model: string }
 *   DELETE /api-key                               → { ok: true }
 *
 *   PATCH  /workspace { settings... }             → Workspace
 */

import { http, unwrap } from './http';
import type { AiProvider, ApiKeyMeta, CreateConnectionPayload, DbConnection } from '@/types';
import { mockConnections } from '@/lib/data/mocks';

const useMocks = process.env.NEXT_PUBLIC_USE_MOCKS === 'true';
const delay = (ms = 400) => new Promise((res) => setTimeout(res, ms));

let connections = [...mockConnections];

let currentApiKey: ApiKeyMeta | null = {
  id: 'key_demo',
  provider: 'openai',
  model: 'gpt-4o',
  lastFour: '7a2c',
  status: 'valid',
  addedAt: '2026-04-18T10:00:00Z',
  lastUsedAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
};

export const connectionsApi = {
  async list(): Promise<DbConnection[]> {
    if (useMocks) {
      await delay(250);
      return connections;
    }
    return unwrap<DbConnection[]>(http.get('/connections'));
  },

  /**
   * Test arbitrary credentials BEFORE saving the connection.
   * BACKEND: POST /connections/test-credentials → { ok, latencyMs, tablesCount? }
   */
  async testCredentials(
    payload: CreateConnectionPayload,
  ): Promise<{ ok: boolean; latencyMs: number; tablesCount?: number; error?: string }> {
    if (useMocks) {
      await delay(900);
      // Simulate a few realistic failure modes for demo authenticity
      if (!payload.host) return { ok: false, latencyMs: 0, error: 'Host is required.' };
      if (payload.host.includes('bad')) {
        return { ok: false, latencyMs: 0, error: 'Could not reach host.' };
      }
      if (payload.password === 'wrong') {
        return { ok: false, latencyMs: 0, error: 'Authentication failed for user.' };
      }
      return { ok: true, latencyMs: 412, tablesCount: 14 };
    }
    return unwrap(http.post('/connections/test-credentials', payload));
  },

  async create(payload: CreateConnectionPayload): Promise<DbConnection> {
    if (useMocks) {
      await delay(600);
      const created: DbConnection = {
        id: 'conn_' + Math.random().toString(36).slice(2, 8),
        name: payload.name,
        provider: payload.provider,
        host: payload.host,
        port: payload.port,
        database: payload.database,
        isReadOnly: true,
        status: 'connected',
        tablesCount: 14,
        lastSyncAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      connections = [created, ...connections];
      return created;
    }
    return unwrap<DbConnection>(http.post('/connections', payload));
  },

  async test(id: string): Promise<{ ok: boolean; latencyMs: number }> {
    if (useMocks) {
      await delay(800);
      return { ok: true, latencyMs: 412 };
    }
    return unwrap<{ ok: boolean; latencyMs: number }>(http.post(`/connections/${id}/test`));
  },

  async remove(id: string): Promise<{ ok: true }> {
    if (useMocks) {
      await delay(200);
      connections = connections.filter((c) => c.id !== id);
      return { ok: true };
    }
    return unwrap<{ ok: true }>(http.delete(`/connections/${id}`));
  },
};

export const apiKeyApi = {
  async get(): Promise<ApiKeyMeta | null> {
    if (useMocks) {
      await delay(200);
      return currentApiKey;
    }
    return unwrap<ApiKeyMeta | null>(http.get('/api-key'));
  },

  async save(provider: AiProvider, key: string): Promise<ApiKeyMeta> {
    if (useMocks) {
      await delay(700);
      currentApiKey = {
        id: 'key_' + Math.random().toString(36).slice(2),
        provider,
        model:
          provider === 'openai'
            ? 'gpt-4o'
            : provider === 'anthropic'
              ? 'claude-opus-4'
              : 'gemini-2.5-pro',
        lastFour: key.slice(-4),
        status: 'valid',
        addedAt: new Date().toISOString(),
        lastUsedAt: null,
      };
      return currentApiKey;
    }
    return unwrap<ApiKeyMeta>(http.post('/api-key', { provider, key }));
  },

  async test(): Promise<{ ok: boolean; latencyMs: number; model: string }> {
    if (useMocks) {
      await delay(900);
      return { ok: true, latencyMs: 412, model: currentApiKey?.model ?? 'gpt-4o' };
    }
    return unwrap<{ ok: boolean; latencyMs: number; model: string }>(http.post('/api-key/test'));
  },

  async remove(): Promise<{ ok: true }> {
    if (useMocks) {
      await delay(200);
      currentApiKey = null;
      return { ok: true };
    }
    return unwrap<{ ok: true }>(http.delete('/api-key'));
  },
};
