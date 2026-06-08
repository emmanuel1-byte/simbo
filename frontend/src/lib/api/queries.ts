/**
 * Conversations API — wraps all /conversations/* endpoints including SSE streaming.
 *
 * Backend endpoints (all under /api/v1):
 *   GET    /conversations                    → Conversation[]
 *   POST   /conversations                    → Conversation
 *   GET    /conversations/:id                → { conversation, messages }
 *   DELETE /conversations/:id                → { message }
 *   GET    /conversations/:id/messages       → Message[]
 *   POST   /conversations/:id/query          { message }  → SSE stream
 *   POST   /conversations/:id/query/voice    (multipart)  → SSE stream
 *
 * SSE event format:
 *   event: step  | token | error | done
 *   data: <json payload>
 */

import { http, unwrap } from './http';
import { tokenStorage } from '@/lib/utils/token-storage';
import type { Conversation, Message, SSEEvent, StepPayload, DonePayload, ErrorPayload } from '@/types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:9090/api/v1';

// ─── Field mapping ────────────────────────────────────────

interface BackendConversation {
  id: string;
  connection_id: string;
  title: { String: string; Valid: boolean } | string;
  connection_name: string;
  connection_db_type: string;
  created_at: string;
  updated_at: string;
}

function mapConversation(c: BackendConversation): Conversation {
  const title = typeof c.title === 'string' ? c.title : (c.title?.Valid ? c.title.String : 'Untitled');
  return {
    id: c.id,
    connectionId: c.connection_id,
    title,
    connectionName: c.connection_name,
    connectionDbType: c.connection_db_type as string,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}

// ─── SSE consumer ────────────────────────────────────────

/**
 * Opens an SSE connection to a query endpoint and yields typed events.
 * Uses fetch + ReadableStream so we can attach the Authorization header
 * (EventSource doesn't support custom headers).
 */
async function* consumeSSE(url: string, body: BodyInit): AsyncGenerator<SSEEvent> {
  const token = tokenStorage.accessToken();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new Error(`SSE request failed (${res.status}): ${text}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by double newlines.
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';

    for (const frame of frames) {
      if (!frame.trim()) continue;

      let kind = '';
      let dataLine = '';

      for (const line of frame.split('\n')) {
        if (line.startsWith('event: ')) kind = line.slice(7).trim();
        if (line.startsWith('data: ')) dataLine = line.slice(6).trim();
      }

      if (!kind || !dataLine) continue;

      try {
        const parsed: unknown = JSON.parse(dataLine);
        yield { kind, data: parsed } as SSEEvent;
      } catch {
        // malformed frame — skip
      }
    }
  }
}

// ─── Conversations API ────────────────────────────────────

export const queriesApi = {
  async listConversations(): Promise<Conversation[]> {
    const rows = await unwrap<BackendConversation[]>(http.get('/conversations'));
    return rows.map(mapConversation);
  },

  async createConversation(connectionId: string, title?: string): Promise<Conversation> {
    const conv = await unwrap<BackendConversation>(
      http.post('/conversations', { connection_id: connectionId, title: title ?? '' }),
    );
    return mapConversation(conv);
  },

  async getConversation(id: string): Promise<{ conversation: Conversation; messages: Message[] }> {
    const data = await unwrap<{ conversation: BackendConversation; messages: Message[] }>(
      http.get(`/conversations/${id}`),
    );
    return { conversation: mapConversation(data.conversation), messages: data.messages };
  },

  async deleteConversation(id: string): Promise<void> {
    await unwrap<{ message: string }>(http.delete(`/conversations/${id}`));
  },

  async listMessages(conversationId: string): Promise<Message[]> {
    return unwrap<Message[]>(http.get(`/conversations/${conversationId}/messages`));
  },

  /**
   * Streams a text query over SSE. Yields typed events as they arrive.
   * Caller is responsible for creating the conversation first if needed.
   */
  async *query(conversationId: string, message: string): AsyncGenerator<SSEEvent> {
    const url = `${BASE_URL}/conversations/${conversationId}/query`;
    yield* consumeSSE(url, JSON.stringify({ message }));
  },

  /**
   * Streams a voice query over SSE. `audio` is a Blob from the microphone.
   */
  async *voiceQuery(conversationId: string, audio: Blob): AsyncGenerator<SSEEvent> {
    const token = tokenStorage.accessToken();
    const form = new FormData();
    form.append('audio', audio, 'recording.webm');

    const url = `${BASE_URL}/conversations/${conversationId}/query/voice`;
    const res = await fetch(url, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '');
      throw new Error(`Voice query failed (${res.status}): ${text}`);
    }

    // Reuse the same SSE frame parser by wrapping the stream.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';
      for (const frame of frames) {
        if (!frame.trim()) continue;
        let kind = '';
        let dataLine = '';
        for (const line of frame.split('\n')) {
          if (line.startsWith('event: ')) kind = line.slice(7).trim();
          if (line.startsWith('data: ')) dataLine = line.slice(6).trim();
        }
        if (!kind || !dataLine) continue;
        try {
          yield { kind, data: JSON.parse(dataLine) } as SSEEvent;
        } catch {
          // skip malformed
        }
      }
    }
  },

  /**
   * High-level helper used by useAskFlow.
   * Creates a conversation (if needed), sends the query, and yields SSE events.
   */
  async *ask(params: {
    message: string;
    connectionId: string;
    conversationId?: string;
  }): AsyncGenerator<SSEEvent & { _conversationId?: string }> {
    let convId = params.conversationId;

    if (!convId) {
      const title = params.message.length > 120
        ? params.message.slice(0, 120) + '…'
        : params.message;
      const conv = await queriesApi.createConversation(params.connectionId, title);
      convId = conv.id;
    }

    // Emit the conversation ID on the first synthetic event so callers can
    // navigate to /chat/:id after creation.
    yield { kind: 'step', data: { phase: 'created', ms: 0 } as StepPayload, _conversationId: convId };

    for await (const event of queriesApi.query(convId, params.message)) {
      yield event;
    }
  },
};

// Re-export payload types for consumers.
export type { StepPayload, DonePayload, ErrorPayload };
