/**
 * Queries / Conversations API.
 *
 * BACKEND CONTRACT:
 *   POST   /queries/ask              { prompt, connectionId } → streamed events OR { message, steps }
 *   GET    /conversations                                     → Conversation[]
 *   GET    /conversations/:id                                 → Conversation
 *   DELETE /conversations/:id                                 → { ok: true }
 *   POST   /conversations/:id/messages { prompt }             → ChatMessage (assistant)
 *
 * For the demo, the `ask` mock simulates a streaming-like progression of steps via setTimeout,
 * exposed through an async generator. Replace with SSE/WebSocket consumption when BE is ready.
 */

import { http, unwrap } from './http';
import type { ChatMessage, Conversation, ExecutionStep } from '@/types';
import { mockConversations, sampleAssistantMessage } from '@/lib/data/mocks';

const useMocks = process.env.NEXT_PUBLIC_USE_MOCKS === 'true';
const delay = (ms = 500) => new Promise((res) => setTimeout(res, ms));

export interface AskPayload {
  prompt: string;
  connectionId: string;
  conversationId?: string;
}

export interface AskEvent {
  type: 'step' | 'message' | 'error';
  step?: ExecutionStep;
  message?: ChatMessage;
  error?: string;
}

const liveStore: Record<string, Conversation> = Object.fromEntries(
  mockConversations.map((c) => [c.id, structuredClone(c)]),
);

export const queriesApi = {
  /**
   * Streamed ask — yields incremental events so the UI can show the timeline live.
   * Backend: replace this with an SSE or WebSocket consumer.
   */
  async *ask(payload: AskPayload): AsyncGenerator<AskEvent> {
    if (!useMocks) {
      // TODO(BE): consume SSE / WS stream from `${API}/queries/ask`
      // For now we just call a non-streaming endpoint and yield one event.
      const message = await unwrap<ChatMessage>(http.post('/queries/ask', payload));
      yield { type: 'message', message };
      return;
    }

    const steps: ExecutionStep[] = [
      { id: 's1', label: 'Parse intent', durationMs: 41, status: 'running' },
      { id: 's2', label: 'Generate SQL', durationMs: 612, status: 'pending' },
      { id: 's3', label: 'Validate guardrails', durationMs: 8, status: 'pending' },
      { id: 's4', label: 'Execute on production', durationMs: 238, status: 'pending' },
      { id: 's5', label: 'Summarize result', durationMs: 320, status: 'pending' },
    ];

    for (let i = 0; i < steps.length; i++) {
      await delay(380 + i * 60);
      steps[i] = { ...steps[i], status: 'done' };
      if (steps[i + 1]) steps[i + 1] = { ...steps[i + 1], status: 'running' };
      yield { type: 'step', step: steps[i] };
    }

    await delay(200);
    yield {
      type: 'message',
      message: {
        ...sampleAssistantMessage,
        id: 'msg_' + Math.random().toString(36).slice(2),
        createdAt: new Date().toISOString(),
        steps,
        status: 'done',
      },
    };
  },

  async listConversations(): Promise<Conversation[]> {
    if (useMocks) {
      await delay(300);
      return Object.values(liveStore).sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    }
    return unwrap<Conversation[]>(http.get('/conversations'));
  },

  async getConversation(id: string): Promise<Conversation | null> {
    if (useMocks) {
      await delay(200);
      return liveStore[id] ?? null;
    }
    return unwrap<Conversation>(http.get(`/conversations/${id}`));
  },

  async deleteConversation(id: string): Promise<{ ok: true }> {
    if (useMocks) {
      await delay(150);
      delete liveStore[id];
      return { ok: true };
    }
    return unwrap<{ ok: true }>(http.delete(`/conversations/${id}`));
  },
};
