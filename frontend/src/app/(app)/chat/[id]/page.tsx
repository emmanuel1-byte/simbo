'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AppTopbar } from '@/components/app/app-topbar';
import { AskBox } from '@/components/app/ask-box';
import { ChatThread } from '@/components/chat/chat-thread';
import { SuggestedPrompts } from '@/components/app/suggested-prompts';
import { AddConnectionModal } from '@/components/app/add-connection-modal';
import { useAskFlow } from '@/lib/hooks/use-ask-flow';
import { useInspector } from '@/contexts/inspector-context';
import { toast } from 'sonner';
import { useConnections } from '@/lib/hooks/use-connections';
import { useAuth } from '@/contexts/auth-context';
import { queriesApi } from '@/lib/api';
import { useWorkspaceName } from '@/lib/hooks/use-workspace-name';
import type { ChatMessage, Message } from '@/types';

function toChat(m: Message): ChatMessage {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: m.createdAt,
    sql: m.sqlQuery,
    result: m.result
      ? { ...m.result, rowCount: m.rowCount, executionMs: m.executionTimeMs, cached: m.isCached }
      : undefined,
    intent: m.interpretation
      ? {
          description: m.interpretation.summary,
          entities: m.interpretation.tags.map((t) => ({
            kind: t.type as 'table' | 'filter' | 'agg' | 'group' | 'range',
            label: t.value,
          })),
        }
      : undefined,
    status: m.error ? 'failed' : 'done',
    errorMessage: m.error,
  };
}

function ChatPageInner() {
  const params    = useParams<{ id: string }>();
  const search    = useSearchParams();
  const router    = useRouter();
  const { user }  = useAuth();
  const { connections, selected: defaultConnection, setSelected, refresh } = useConnections();
  const askFlow   = useAskFlow();
  const workspaceName = useWorkspaceName();
  const { setInspector } = useInspector();

  const [messages, setMessages]       = useState<ChatMessage[]>([]);
  const [title, setTitle]             = useState('New conversation');
  const [showAddConn, setShowAddConn] = useState(false);
  const seedRanRef                    = useRef(false);
  const resolvedConvIdRef             = useRef<string | null>(null);

  const initialPrompt     = search.get('prompt');
  const connectionIdParam = search.get('connection');
  const isNew             = params.id?.startsWith('new_');

  const connection =
    (connectionIdParam ? connections.find((c) => c.id === connectionIdParam) : null) ??
    defaultConnection ??
    null;

  // Keep sidebar inspector in sync
  const lastAssistant =
    askFlow.pendingAssistant ??
    [...messages].reverse().find((m) => m.role === 'assistant') ??
    null;

  useEffect(() => {
    setInspector(lastAssistant, askFlow.liveSteps);
  }, [lastAssistant, askFlow.liveSteps, setInspector]);

  useEffect(() => {
    if (connection && connection.id !== defaultConnection?.id) setSelected(connection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection?.id]);

  useEffect(() => {
    if (isNew) return;
    if (askFlow.isRunning) return;
    let mounted = true;
    queriesApi.getConversation(params.id)
      .then(({ conversation, messages: msgs }) => {
        if (!mounted) return;
        setMessages(msgs.map(toChat));
        if (conversation.title && conversation.title !== 'Untitled') setTitle(conversation.title);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [params.id, isNew, askFlow.isRunning]);

  useEffect(() => {
    if (seedRanRef.current) return;
    if (!initialPrompt) return;
    if (isNew && !connection) return;
    seedRanRef.current = true;
    runPrompt(initialPrompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt, connection, isNew]);

  async function runPrompt(prompt: string) {
    const effectiveConnectionId = connection?.id ?? connectionIdParam ?? '';
    if (isNew && !effectiveConnectionId) {
      toast.error('Select a database connection first.');
      return;
    }
    const userMsg: ChatMessage = {
      id:        'msg_' + Math.random().toString(36).slice(2),
      role:      'user',
      content:   prompt,
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, userMsg]);
    setTitle(prompt.length > 60 ? prompt.slice(0, 60) + '…' : prompt);

    const activeConvId = resolvedConvIdRef.current ?? (isNew ? undefined : params.id);
    const result = await askFlow.ask({
      message:        prompt,
      connectionId:   effectiveConnectionId,
      conversationId: activeConvId,
    });

    if (result.message) {
      setMessages((m) => [...m, result.message!]);
      askFlow.reset();
    }

    if (result.conversationId) {
      resolvedConvIdRef.current = result.conversationId;
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `/chat/${result.conversationId}`);
      }
    }
  }

  function handleEdit(messageId: string, newContent: string) {
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx === -1) return;
    setMessages(messages.slice(0, idx));
    void runPrompt(newContent);
  }

  const isEmpty = messages.length === 0 && !askFlow.pendingAssistant;

  return (
    <div className="flex h-screen flex-col">

      {/* Topbar */}
      <AppTopbar
        crumb={<span className="font-mono text-[12px] text-paper-3">{workspaceName}</span>}
        title={isEmpty ? undefined : title}
        right={
          connection?.name ? (
            <span className="flex items-center gap-1.5 rounded-sm border border-rule bg-ink-4 px-2 py-0.5 font-mono text-[10px] text-paper-2">
              <span className="h-1.5 w-1.5 rounded-full bg-ok" />
              {connection.name}
            </span>
          ) : undefined
        }
      />

      {isEmpty ? (
        /* ── Empty state ────────────────────────────────────────────────── */
        <div className="flex flex-1 flex-col items-center justify-center gap-8 overflow-y-auto px-6 py-12">

          <div className="w-full max-w-[640px] text-center">
            <p className="label-eyebrow mb-4">Database intelligence</p>
            <h1 className="font-serif text-[42px] font-normal leading-[1.1] tracking-[-0.025em] text-paper md:text-[52px]">
              What do you want to{' '}
              <em className="text-accent" style={{ fontStyle: 'italic' }}>know?</em>
            </h1>
            <p className="mx-auto mt-4 max-w-[380px] text-[14px] leading-relaxed text-paper-2">
              Ask in plain English. Simbo generates the SQL, runs it, and explains the result.
            </p>
          </div>

          <div className="w-full max-w-[640px]">
            <AskBox
              connection={connection}
              connections={connections}
              onConnectionSelect={setSelected}
              onAddConnection={() => setShowAddConn(true)}
              onSubmit={runPrompt}
              autoFocus
              size="lg"
              placeholder="Ask anything about your data…"
            />

            {!connection && !connections.length && (
              <div className="mt-3 flex items-center gap-2 font-mono text-[11px] text-paper-3">
                <span className="h-1.5 w-1.5 rounded-full bg-warn/60" />
                No database connected —{' '}
                <button
                  type="button"
                  onClick={() => setShowAddConn(true)}
                  className="text-accent underline underline-offset-2 transition-opacity hover:opacity-75"
                >
                  add one to start
                </button>
              </div>
            )}
          </div>

          <SuggestedPrompts
            connectionId={connection?.id}
            onPick={(prompt) => {
              if (!connection) { setShowAddConn(true); return; }
              runPrompt(prompt);
            }}
          />

          <div className="flex items-center gap-6 font-mono text-[10px] uppercase tracking-[0.14em] text-paper-3">
            <span>✓ Read-only</span>
            <span>✓ Full SQL transparency</span>
          </div>

        </div>
      ) : (
        /* ── Active chat — full width, no right panel ───────────────────── */
        <div className="flex flex-1 flex-col overflow-hidden">
          <ChatThread
            messages={messages}
            pending={askFlow.pendingAssistant}
            liveSteps={askFlow.liveSteps}
            userInitial={user?.name?.[0]?.toUpperCase() ?? 'A'}
            onEdit={handleEdit}
          />

          {/* Composer */}
          <div className="flex-shrink-0 border-t border-rule bg-ink-2 px-5 py-4">
            <div className="mx-auto w-full max-w-[720px]">
              <AskBox
                connection={connection}
                connections={connections}
                onConnectionSelect={setSelected}
                onAddConnection={() => setShowAddConn(true)}
                onSubmit={runPrompt}
                size="md"
                placeholder="Ask a follow-up…"
                disabled={askFlow.isRunning}
              />
            </div>
          </div>
        </div>
      )}

      <AddConnectionModal
        open={showAddConn}
        onClose={() => setShowAddConn(false)}
        onCreated={() => refresh()}
      />
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatPageInner />
    </Suspense>
  );
}
