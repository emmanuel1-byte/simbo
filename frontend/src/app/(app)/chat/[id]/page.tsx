'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AppTopbar } from '@/components/app/app-topbar';
import { AskBox } from '@/components/app/ask-box';
import { ChatThread } from '@/components/chat/chat-thread';
import { Inspector } from '@/components/chat/inspector';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/ui/pill';
import { ArrowLeft } from '@/components/icons';
import { useAskFlow } from '@/lib/hooks/use-ask-flow';
import { useConnections } from '@/lib/hooks/use-connections';
import { useAuth } from '@/contexts/auth-context';
import { queriesApi } from '@/lib/api';
import type { ChatMessage } from '@/types';

function ChatPageInner() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { selected: connection } = useConnections();
  const askFlow = useAskFlow();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [title, setTitle] = useState('New conversation');
  const seedRanRef = useRef(false);

  const initialPrompt = search.get('prompt');
  const isNew = params.id?.startsWith('new_');

  // Load existing conversation if not "new_*"
  useEffect(() => {
    if (isNew) return;
    let mounted = true;
    queriesApi.getConversation(params.id).then((conv) => {
      if (!mounted || !conv) return;
      setMessages(conv.messages);
      setTitle(conv.title);
    });
    return () => {
      mounted = false;
    };
  }, [params.id, isNew]);

  // Auto-run the seeded prompt for fresh conversations.
  useEffect(() => {
    if (seedRanRef.current) return;
    if (!initialPrompt || !connection) return;
    seedRanRef.current = true;
    runPrompt(initialPrompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt, connection]);

  async function runPrompt(prompt: string) {
    if (!connection) return;
    const userMsg: ChatMessage = {
      id: 'msg_' + Math.random().toString(36).slice(2),
      role: 'user',
      content: prompt,
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, userMsg]);
    setTitle(prompt.length > 40 ? prompt.slice(0, 40) + '…' : prompt);

    const finalAssistant = await askFlow.ask({
      prompt,
      connectionId: connection.id,
      conversationId: isNew ? undefined : params.id,
    });

    if (finalAssistant) {
      setMessages((m) => [...m, finalAssistant]);
    }
  }

  const lastAssistant =
    askFlow.pendingAssistant ??
    [...messages].reverse().find((m) => m.role === 'assistant') ??
    null;

  return (
    <>
      <AppTopbar
        crumb={
          <button
            onClick={() => router.push('/ask')}
            className="flex items-center gap-2 transition-colors hover:text-paper"
          >
            <ArrowLeft size={12} />
            workspace · acme analytics
          </button>
        }
        title={title}
        right={
          <>
            <Pill variant="muted">
              {connection?.name ?? 'no connection'}
            </Pill>
            <Button size="sm" variant="secondary">
              Export
            </Button>
            <Button size="sm" variant="secondary">
              Share
            </Button>
          </>
        }
      />

      <div className="grid flex-1 overflow-hidden lg:grid-cols-[1.15fr_1fr]">
        {/* LEFT: thread + composer */}
        <div className="grid grid-rows-[1fr_auto] overflow-hidden lg:border-r lg:border-rule">
          <ChatThread
            messages={messages}
            pending={askFlow.pendingAssistant}
            userInitial={user?.name?.[0]?.toUpperCase() ?? 'A'}
          />

          <div className="border-t border-rule bg-ink-2 px-7 py-4">
            <AskBox
              connection={connection}
              onSubmit={runPrompt}
              size="md"
              placeholder="Ask a follow-up…"
              disabled={askFlow.isRunning}
            />
          </div>
        </div>

        {/* RIGHT: inspector */}
        <div className="hidden overflow-hidden border-t border-rule lg:block lg:border-t-0">
          <Inspector message={lastAssistant} liveSteps={askFlow.liveSteps} />
        </div>
      </div>
    </>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatPageInner />
    </Suspense>
  );
}
