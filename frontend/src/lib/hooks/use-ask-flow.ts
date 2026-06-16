'use client';

import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { queriesApi } from '@/lib/api';
import type { ChatMessage, ExecutionStep, StepPayload } from '@/types';

function humanizeError(raw: string): string {
  const r = raw.toLowerCase();
  if (r.includes('no active api key')) return raw;
  if (r.includes('conversation not found')) return raw;
  if (r.includes('database connection not found')) return raw;
  if (r.includes('add one in settings')) return raw;
  if ((r.includes('column') || r.includes('field')) && r.includes('does not exist'))
    return "Your question referenced a column that doesn't exist. Try rephrasing.";
  if (r.includes('relation') && r.includes('does not exist'))
    return "Your question referenced a table that doesn't exist. Try rephrasing.";
  if (r.includes('permission denied') || r.includes('access denied'))
    return "The database user doesn't have permission to access that data.";
  if (r.includes('syntax error') || r.includes('parse error'))
    return "Simbo had trouble forming a valid query. Try asking in a different way.";
  if (r.includes('connection refused') || r.includes('connection reset') || r.includes('no connection'))
    return "Lost connection to the database. Check your connection in Settings.";
  if (r.includes('deadlock') || r.includes('could not obtain lock'))
    return "The database is busy. Try again in a moment.";
  if (r.includes('context deadline exceeded') || r.includes('timed out') || r.includes('timeout'))
    return "The request timed out. Try a simpler question or try again.";
  if (r.includes('rate limit') || r.includes('too many requests'))
    return "Your AI provider is rate-limited. Wait a moment and try again.";
  if ((r.includes('api key') || r.includes('invalid key')) && r.includes('invalid'))
    return "Your AI API key is invalid or expired. Go to Settings → API key to update it.";
  if (r.includes('sql generation failed'))
    return "Simbo couldn't understand your question well enough to run a query. Try being more specific.";
  if (r.includes('summary generation failed'))
    return "The query ran but the summary couldn't be generated. The result table below is still accurate.";
  if (r.includes('schema introspection failed'))
    return "Couldn't read the database schema. Check that your connection is active.";
  if (r.includes('guardrail blocked'))
    return "That query was blocked. Simbo only allows read-only SELECT queries.";
  if (r.includes('query failed'))
    return "The query failed to execute. Try rephrasing your question.";
  return "Something went wrong. Try rephrasing your question or check your connection.";
}

export interface AskResult {
  message: ChatMessage | null;
  conversationId: string | null;
}

export interface UseAskFlowReturn {
  pendingAssistant: ChatMessage | null;
  liveSteps: ExecutionStep[];
  isRunning: boolean;
  ask: (params: {
    message: string;
    connectionId: string;
    conversationId?: string;
  }) => Promise<AskResult>;
  reset: () => void;
}

const PHASE_LABELS: Record<string, string> = {
  created: 'Created conversation',
  transcribing: 'Transcribing audio',
  transcribed: 'Transcribed',
  parsing: 'Parse intent',
  sql_ready: 'Generate SQL',
  validating: 'Validate guardrails',
  validated: 'Validated',
  executing: 'Execute query',
  executed: 'Executed',
};

let stepCounter = 0;

function phaseToStep(phase: string, ms: number, status: ExecutionStep['status']): ExecutionStep {
  return { id: `step_${++stepCounter}`, label: PHASE_LABELS[phase] ?? phase, durationMs: ms, status };
}

export function useAskFlow(): UseAskFlowReturn {
  const [pendingAssistant, setPendingAssistant] = useState<ChatMessage | null>(null);
  const [liveSteps, setLiveSteps] = useState<ExecutionStep[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const convIdRef    = useRef<string | null>(null);
  // Mirror of liveSteps so we can read the current value synchronously in async code.
  const liveStepsRef = useRef<ExecutionStep[]>([]);

  const reset = useCallback(() => {
    setPendingAssistant(null);
    setIsRunning(false);
    convIdRef.current = null;
    // liveSteps intentionally NOT cleared so the inspector keeps showing
    // the last timeline after the message completes.
  }, []);

  const ask = useCallback<UseAskFlowReturn['ask']>(async ({ message, connectionId, conversationId }) => {
    stepCounter = 0;
    setIsRunning(true);
    setLiveSteps([]);
    liveStepsRef.current = [];
    convIdRef.current = conversationId ?? null;
    setPendingAssistant({
      id: 'pending',
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      status: 'parsing',
    });

    let createdConvId: string | null = null;

    try {
      let finalMessage: ChatMessage | null = null;

      for await (const event of queriesApi.ask({ message, connectionId, conversationId })) {
        const convEvent = event as typeof event & { _conversationId?: string };
        if (convEvent._conversationId && !convIdRef.current) {
          convIdRef.current = convEvent._conversationId;
          if (!conversationId) createdConvId = convEvent._conversationId;
        }

        if (event.kind === 'step') {
          const payload = event.data as StepPayload;
          if (payload.phase === 'created') continue;
          setLiveSteps((prev) => {
            const existing = prev.findIndex((s) => s.label === (PHASE_LABELS[payload.phase] ?? payload.phase));
            const step = phaseToStep(payload.phase, payload.ms, 'done');
            const next = existing >= 0
              ? prev.map((s, i) => (i === existing ? step : s))
              : [...prev, step];
            liveStepsRef.current = next;
            return next;
          });
        }

        // Per-token streaming: each token updates the state directly.
        // React 18 will render each update individually when tokens arrive at
        // natural LLM speed (~20-100ms apart). No RAF buffer — that was causing
        // the "dump everything at once" effect.
        if (event.kind === 'token') {
          const token = event.data as string;
          setPendingAssistant((prev) => {
            if (!prev) return prev;
            return { ...prev, content: prev.content + token, status: 'summarizing' };
          });
        }

        if (event.kind === 'done') {
          const done = event.data as { messageId: string; totalMs: number };
          if (convIdRef.current) {
            const msgs = await queriesApi.listMessages(convIdRef.current).catch(() => []);
            const msg = msgs.find((m) => m.id === done.messageId);
            if (msg) {
              finalMessage = {
                id: msg.id,
                role: msg.role as 'user' | 'assistant',
                content: msg.content,
                createdAt: msg.createdAt,
                status: 'done',
                sql: msg.sqlQuery,
                // Persist the live timeline so the inspector keeps showing it
                steps: liveStepsRef.current.length > 0 ? [...liveStepsRef.current] : undefined,
                result: msg.result
                  ? { ...msg.result, rowCount: msg.rowCount ?? 0, executionMs: msg.executionTimeMs ?? 0, cached: msg.isCached }
                  : undefined,
                intent: msg.interpretation
                  ? {
                      description: msg.interpretation.summary,
                      entities: msg.interpretation.tags.map((t) => ({
                        kind: t.type as 'table' | 'filter' | 'agg' | 'group' | 'range',
                        label: t.value,
                      })),
                    }
                  : undefined,
              };
            }
          }
        }

        if (event.kind === 'error') {
          const err = event.data as { phase: string; message: string };
          throw new Error(humanizeError(err.message));
        }
      }

      // Don't null pending here — let the caller do it alongside setMessages
      // so React 18 batches both into one render (no blank flash between states).
      setIsRunning(false);
      return { message: finalMessage, conversationId: createdConvId };
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
      return { message: null, conversationId: createdConvId };
    }
  }, []);

  return { pendingAssistant, liveSteps, isRunning, ask, reset };
}
