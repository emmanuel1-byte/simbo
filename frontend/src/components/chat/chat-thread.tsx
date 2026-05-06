'use client';

import { useEffect, useRef } from 'react';
import { Pill } from '@/components/ui/pill';
import { AnswerCard } from '@/components/results/answer-card';
import { cn } from '@/lib/utils/cn';
import type { ChatMessage } from '@/types';
import { formatRelative } from '@/lib/utils/format';

interface ChatThreadProps {
  messages: ChatMessage[];
  pending?: ChatMessage | null;
  userInitial: string;
}

/**
 * Auto-scrolls to the bottom whenever new content arrives.
 */
export function ChatThread({ messages, pending, userInitial }: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, pending?.status, pending?.id]);

  return (
    <div className="flex flex-col gap-6 overflow-auto px-7 py-6">
      {messages.map((msg) => (
        <Message key={msg.id} message={msg} userInitial={userInitial} />
      ))}
      {pending && <Message message={pending} userInitial={userInitial} />}
      <div ref={bottomRef} />
    </div>
  );
}

function Message({ message, userInitial }: { message: ChatMessage; userInitial: string }) {
  const isUser = message.role === 'user';
  const isPending = message.id === 'pending';
  return (
    <div className="flex items-start gap-3.5 animate-fade-in-up">
      <div
        className={cn(
          'grid h-[30px] w-[30px] flex-shrink-0 place-items-center rounded-full font-mono text-[11px]',
          isUser
            ? 'bg-gradient-to-br from-[#c4a07a] to-[#7a5b3a] text-paper font-medium'
            : 'bg-accent text-ink font-bold',
        )}
      >
        {isUser ? userInitial : 'S'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center gap-2.5 font-mono text-2xs uppercase tracking-[0.16em] text-muted">
          <b className="font-medium text-paper">{isUser ? 'You' : 'Simbo'}</b>
          <span>{formatRelative(message.createdAt)}</span>
          {message.status === 'failed' && <Pill variant="warn">failed</Pill>}
          {!isUser && !isPending && message.status === 'done' && (
            <Pill variant="safe">verified</Pill>
          )}
          {!isUser && isPending && (
            <Pill variant="warn">running…</Pill>
          )}
        </div>

        {isUser ? (
          <div className="text-sm leading-[1.6] text-paper">{message.content}</div>
        ) : isPending ? (
          <div className="font-serif italic text-muted">
            <span className="inline-block">
              {message.content}
              <DotPulse />
            </span>
          </div>
        ) : (
          <>
            <div className="font-serif text-lg font-light leading-[1.45] text-paper">
              {renderAnswerWithEmphasis(message.content)}
            </div>
            {message.result && (
              <AnswerCard result={message.result} cached={message.result.cached} />
            )}
            {message.errorMessage && (
              <div className="mt-3 rounded-xl border border-warn/40 bg-warn/5 p-4 font-mono text-[12px] text-warn">
                {message.errorMessage}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Highlights numbers and percentages with the accent color.
 * "1,284 new active users — a 17.6% lift" → numbers wrapped in <em class="text-accent italic">.
 */
function renderAnswerWithEmphasis(text: string) {
  const parts = text.split(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?%?)/g);
  return parts.map((p, i) => {
    if (/^\d/.test(p)) {
      return (
        <em key={i} className="text-accent" style={{ fontStyle: 'italic' }}>
          {p}
        </em>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

function DotPulse() {
  return (
    <span className="ml-1 inline-flex gap-1">
      <span className="h-1 w-1 animate-pulse rounded-full bg-accent" style={{ animationDelay: '0ms' }} />
      <span className="h-1 w-1 animate-pulse rounded-full bg-accent" style={{ animationDelay: '150ms' }} />
      <span className="h-1 w-1 animate-pulse rounded-full bg-accent" style={{ animationDelay: '300ms' }} />
    </span>
  );
}
