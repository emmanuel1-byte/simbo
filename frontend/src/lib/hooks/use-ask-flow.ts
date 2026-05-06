'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { queriesApi } from '@/lib/api';
import type { ChatMessage, ExecutionStep } from '@/types';

export interface UseAskFlowReturn {
  /** Pending assistant message accumulating live updates. */
  pendingAssistant: ChatMessage | null;
  liveSteps: ExecutionStep[];
  isRunning: boolean;
  /** Start a query. Returns the final assistant message when done. */
  ask: (params: {
    prompt: string;
    connectionId: string;
    conversationId?: string;
  }) => Promise<ChatMessage | null>;
  reset: () => void;
}

/**
 * Owns the state of an in-flight query.
 *
 * Why a hook? The streaming logic (consume async generator, accumulate steps,
 * produce a final assistant message) is the same on both /ask and /chat/[id].
 */
export function useAskFlow(): UseAskFlowReturn {
  const [pendingAssistant, setPendingAssistant] = useState<ChatMessage | null>(null);
  const [liveSteps, setLiveSteps] = useState<ExecutionStep[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const reset = useCallback(() => {
    setPendingAssistant(null);
    setLiveSteps([]);
    setIsRunning(false);
  }, []);

  const ask = useCallback<UseAskFlowReturn['ask']>(async ({ prompt, connectionId, conversationId }) => {
    setIsRunning(true);
    setLiveSteps([
      { id: 's1', label: 'Parse intent', status: 'running' },
      { id: 's2', label: 'Generate SQL', status: 'pending' },
      { id: 's3', label: 'Validate guardrails', status: 'pending' },
      { id: 's4', label: 'Execute on production', status: 'pending' },
      { id: 's5', label: 'Summarize result', status: 'pending' },
    ]);

    setPendingAssistant({
      id: 'pending',
      role: 'assistant',
      content: 'Working on it…',
      createdAt: new Date().toISOString(),
      status: 'parsing',
    });

    try {
      let finalMessage: ChatMessage | null = null;

      for await (const event of queriesApi.ask({ prompt, connectionId, conversationId })) {
        if (event.type === 'step' && event.step) {
          setLiveSteps((prev) => {
            const next = prev.map((s) => (s.id === event.step!.id ? event.step! : s));
            const idx = next.findIndex((s) => s.id === event.step!.id);
            // advance the next pending step to running
            if (idx >= 0 && next[idx + 1] && next[idx + 1].status === 'pending') {
              next[idx + 1] = { ...next[idx + 1], status: 'running' };
            }
            return next;
          });
        }
        if (event.type === 'message' && event.message) {
          finalMessage = event.message;
        }
        if (event.type === 'error') {
          throw new Error(event.error ?? 'Query failed');
        }
      }

      setPendingAssistant(null);
      setIsRunning(false);
      return finalMessage;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Query failed';
      toast.error(msg);
      setPendingAssistant({
        id: 'pending',
        role: 'assistant',
        content: msg,
        createdAt: new Date().toISOString(),
        status: 'failed',
        errorMessage: msg,
      });
      setIsRunning(false);
      return null;
    }
  }, []);

  return { pendingAssistant, liveSteps, isRunning, ask, reset };
}
