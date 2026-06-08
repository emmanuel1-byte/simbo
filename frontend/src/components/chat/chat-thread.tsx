'use client';

import { useEffect, useRef, useState } from 'react';
import { AnswerCard } from '@/components/results/answer-card';
import { SqlHighlight } from '@/components/chat/sql-highlight';
import { Pencil, X, ArrowRight, Copy } from '@/components/icons';
import { cn } from '@/lib/utils/cn';
import { toast } from 'sonner';
import type { ChatMessage, ExecutionStep } from '@/types';
import { formatRelative } from '@/lib/utils/format';

interface ChatThreadProps {
  messages: ChatMessage[];
  pending?: ChatMessage | null;
  liveSteps?: ExecutionStep[];
  userInitial: string;
  onEdit?: (messageId: string, newContent: string) => void;
}

export function ChatThread({ messages, pending, liveSteps, userInitial, onEdit }: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, pending?.id]);

  useEffect(() => {
    if (pending?.status === 'summarizing') {
      bottomRef.current?.scrollIntoView({ behavior: 'instant', block: 'end' });
    }
  }, [pending?.content, pending?.status]);

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-2 px-6 py-10">
        {messages.map((msg, idx) => (
          <MessageRow
            key={msg.id}
            message={msg}
            userInitial={userInitial}
            onEdit={onEdit}
            // Give the last assistant message liveSteps as fallback so steps
            // persist on the completed card even before message.steps is set.
            liveSteps={!pending && idx === messages.length - 1 && msg.role === 'assistant' ? liveSteps : undefined}
          />
        ))}
        {pending && <MessageRow message={pending} userInitial={userInitial} liveSteps={liveSteps} />}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

interface MessageRowProps {
  message: ChatMessage;
  userInitial: string;
  liveSteps?: ExecutionStep[];
  onEdit?: (id: string, content: string) => void;
}

function MessageRow({ message, userInitial, liveSteps, onEdit }: MessageRowProps) {
  return message.role === 'user'
    ? <UserMessage message={message} userInitial={userInitial} onEdit={onEdit} />
    : <AssistantMessage message={message} liveSteps={liveSteps} />;
}

// ─── User message ──────────────────────────────────────────────────────────────

function UserMessage({
  message,
  userInitial,
  onEdit,
}: {
  message: ChatMessage;
  userInitial: string;
  onEdit?: (id: string, c: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(message.content);
  const ref = useRef<HTMLTextAreaElement>(null);

  function start()  { setDraft(message.content); setEditing(true); setTimeout(() => ref.current?.focus(), 0); }
  function cancel() { setEditing(false); setDraft(message.content); }
  function submit() {
    const t = draft.trim();
    if (!t || t === message.content) { cancel(); return; }
    setEditing(false);
    onEdit?.(message.id, t);
  }
  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
    if (e.key === 'Escape') cancel();
  }

  return (
    <div className="group mb-6 flex justify-end">
      <div className="flex max-w-[76%] flex-col items-end gap-1.5">
        {editing ? (
          <div className="flex w-full flex-col gap-2">
            <textarea
              ref={ref}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKey}
              rows={3}
              className="w-full resize-none rounded-xl border border-rule-2 bg-ink-4 px-4 py-3 text-[14px] leading-[1.7] text-paper outline-none placeholder:text-paper-3 focus:border-accent"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={cancel}
                className="flex items-center gap-1.5 rounded-sm border border-rule-2 px-3 py-1.5 font-mono text-[11px] text-paper-2 transition-colors hover:border-rule-3 hover:text-paper">
                <X size={10} /> Cancel
              </button>
              <button type="button" onClick={submit}
                className="flex items-center gap-1.5 rounded-sm bg-accent px-3 py-1.5 font-mono text-[11px] font-medium text-paper-inv transition-colors hover:bg-accent-2">
                Run <ArrowRight size={10} />
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-2xl rounded-tr-sm bg-ink-5 px-4 py-3">
              <p className="whitespace-pre-wrap text-[14px] leading-[1.75] text-paper">
                {message.content}
              </p>
            </div>
            <div className="flex items-center gap-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              <span className="font-mono text-[10px] text-paper-3">{formatRelative(message.createdAt)}</span>
              {onEdit && message.id !== 'pending' && (
                <button type="button" onClick={start}
                  className="flex items-center gap-1 font-mono text-[10px] text-paper-3 transition-colors hover:text-accent">
                  <Pencil size={9} /> edit
                </button>
              )}
            </div>
          </>
        )}
      </div>
      <span className="ml-2.5 mt-0.5 grid h-7 w-7 flex-shrink-0 place-items-center self-end rounded-full bg-gradient-to-br from-[#c4a07a] to-[#8a6040] font-mono text-[10px] font-medium text-white/90">
        {userInitial}
      </span>
    </div>
  );
}

// ─── Assistant message ────────────────────────────────────────────────────────

type EvidenceTab = 'sql' | 'timeline' | 'intent';

function AssistantMessage({ message, liveSteps }: { message: ChatMessage; liveSteps?: ExecutionStep[] }) {
  const isPending   = message.id === 'pending';
  const isStreaming = isPending && message.status === 'summarizing';
  const isThinking  = isPending && !isStreaming && message.status !== 'failed';
  const isFailed    = message.status === 'failed';

  const steps        = liveSteps ?? message.steps ?? [];
  const hasSql       = !!message.sql;
  const hasTimeline  = steps.length > 0;
  const hasIntent    = !!message.intent;
  const hasEvidence  = hasSql || hasTimeline || hasIntent;

  const [openTab, setOpenTab]   = useState<EvidenceTab | null>(null);
  const [userChose, setUserChose] = useState(false);

  // While running → open Timeline so user can watch progress.
  // Once done → keep Timeline open (persist it). User can switch to SQL manually.
  useEffect(() => {
    if (!userChose && hasTimeline) setOpenTab('timeline');
    if (!userChose && !hasTimeline && hasSql) setOpenTab('sql');
  }, [hasTimeline, hasSql, userChose]);

  function toggleTab(tab: EvidenceTab) {
    setUserChose(true);
    setOpenTab((prev) => (prev === tab ? null : tab));
  }

  const availableTabs: { id: EvidenceTab; label: string; available: boolean }[] = [
    { id: 'sql',      label: 'SQL',      available: hasSql },
    { id: 'timeline', label: 'Timeline', available: hasTimeline },
    { id: 'intent',   label: 'Intent',   available: hasIntent },
  ];

  return (
    <div className="mb-8 flex gap-3">
      {/* Simbo avatar */}
      <span className={cn(
        'mt-1 grid h-7 w-7 flex-shrink-0 place-items-center rounded-full font-mono text-[11px] font-bold',
        isFailed ? 'bg-warn/15 text-warn' : 'bg-accent text-paper-inv',
      )}>
        S
      </span>

      <div className="min-w-0 flex-1">
        {/* Name + timestamp */}
        <div className="mb-2 flex items-baseline gap-2">
          <span className={cn('font-mono text-[11px] font-semibold', isFailed ? 'text-warn' : 'text-accent')}>
            Simbo
          </span>
          {!isPending && (
            <span className="font-mono text-[10px] text-paper-3">{formatRelative(message.createdAt)}</span>
          )}
        </div>

        {/* Answer card */}
        {isThinking ? (
          <ThinkingDots />
        ) : isFailed ? (
          <div className="rounded-xl border border-warn/20 bg-warn/5 px-4 py-3">
            <p className="text-[13.5px] leading-relaxed text-warn">{message.content}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-rule bg-ink-3 px-5 py-4">
            <div className={cn('font-serif text-[16.5px] font-normal leading-[1.7] text-paper', isStreaming && 'stream-cursor')}>
              <RenderedText text={message.content} />
            </div>
            {!isPending && message.result && (
              <div className="mt-4 border-t border-rule pt-4">
                <AnswerCard result={message.result} cached={message.result.cached} />
              </div>
            )}

            {/* ── Evidence tabs ─────────────────────────────────────────── */}
            {hasEvidence && (
              <div className="mt-4 border-t border-rule pt-3">
                {/* Tab pills */}
                <div className="flex items-center gap-1">
                  {availableTabs.filter((t) => t.available).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTab(t.id)}
                      className={cn(
                        'rounded-sm px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors',
                        openTab === t.id
                          ? 'bg-ink-5 text-paper'
                          : 'text-paper-3 hover:bg-ink-4 hover:text-paper-2',
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                {openTab === 'sql'      && hasSql      && <SqlPanel sql={message.sql!} result={message.result} />}
                {openTab === 'timeline' && hasTimeline && <TimelinePanel steps={steps} />}
                {openTab === 'intent'   && hasIntent   && <IntentPanel message={message} />}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SQL panel ────────────────────────────────────────────────────────────────

function SqlPanel({ sql, result }: { sql: string; result?: ChatMessage['result'] }) {
  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className="overflow-hidden rounded-md border border-rule-2 bg-ink">
        <div className="flex items-center border-b border-rule px-4 py-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-paper-3">query.sql</span>
          <button
            type="button"
            onClick={() => { navigator.clipboard.writeText(sql); toast.success('Copied'); }}
            className="ml-auto flex items-center gap-1.5 rounded-xs border border-rule px-2 py-1 font-mono text-[9px] text-paper-3 transition-colors hover:border-rule-2 hover:text-paper"
          >
            <Copy size={10} /> Copy
          </button>
        </div>
        <SqlHighlight code={sql} />
      </div>
      {result && (
        <div className="flex items-center gap-3 rounded-sm border border-rule bg-ink px-3 py-2 font-mono text-[10px] text-paper-2">
          <span className="h-1.5 w-1.5 rounded-full bg-ok" />
          {result.rowCount ?? result.rows.length} rows · {result.executionMs ?? 0}ms
        </div>
      )}
    </div>
  );
}

// ─── Timeline panel ───────────────────────────────────────────────────────────

function TimelinePanel({ steps }: { steps: ExecutionStep[] }) {
  const totalMs = steps.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);

  return (
    <div className="mt-3 relative pl-5">
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-rule-2" />
      {steps.map((step) => (
        <div key={step.id} className="relative mb-4 last:mb-0">
          <span className={cn(
            'absolute -left-[18px] top-[5px] h-[9px] w-[9px] rounded-full border transition-all',
            step.status === 'done'    && 'border-ok bg-ok shadow-[0_0_6px_rgba(62,156,110,0.4)]',
            step.status === 'running' && 'animate-pulse border-accent bg-accent/30',
            step.status === 'pending' && 'border-rule-2 bg-ink-4',
            step.status === 'failed'  && 'border-warn bg-warn',
          )} />
          <div className="flex items-baseline gap-2">
            <span className="text-[12px] text-paper">{step.label}</span>
            <span className="font-mono text-[10px] text-paper-3">
              {step.status === 'running' ? '· running…'
                : step.status === 'pending' ? '· queued'
                : step.durationMs != null ? `· ${step.durationMs}ms`
                : ''}
            </span>
          </div>
          {step.description && (
            <p className="mt-0.5 text-[11px] leading-relaxed text-paper-2">{step.description}</p>
          )}
          {step.status === 'done' && step.durationMs != null && totalMs > 0 && (
            <div className="mt-1.5 h-[3px] w-full max-w-[180px] overflow-hidden rounded-full bg-ink-5">
              <span
                className="block h-full rounded-full bg-accent/40"
                style={{ width: `${Math.max(6, (step.durationMs / totalMs) * 100)}%` }}
              />
            </div>
          )}
        </div>
      ))}
      {totalMs > 0 && (
        <div className="flex items-center gap-2 border-t border-rule pt-3 mt-3">
          <span className="label-eyebrow">Total</span>
          <span className="font-mono text-[13px] font-medium text-accent">{totalMs}ms</span>
        </div>
      )}
    </div>
  );
}

// ─── Intent panel ─────────────────────────────────────────────────────────────

function IntentPanel({ message }: { message: ChatMessage }) {
  const intent = message.intent;
  if (!intent) return null;

  const colorMap = {
    table:  'border-accent/30 text-accent/80',
    filter: 'border-info/30 text-info/80',
    agg:    'border-caution/30 text-caution/80',
    range:  'border-rule-2 text-paper-2',
    group:  'border-rule-2 text-paper-2',
  } as const;

  return (
    <div className="mt-3 flex flex-col gap-3">
      <p className="font-serif text-[15px] font-normal leading-[1.6] text-paper">{intent.description}</p>
      {intent.entities.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {intent.entities.map((e, i) => (
            <span key={i} className={cn('rounded-xs border px-2.5 py-1 font-mono text-[9px] tracking-wide', colorMap[e.kind])}>
              {e.kind} · {e.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function ThinkingDots() {
  return (
    <div className="flex items-center gap-[5px] rounded-xl border border-rule bg-ink-3 px-4 py-3.5">
      {[0, 160, 320].map((delay) => (
        <span key={delay}
          className="h-[5px] w-[5px] animate-pulse rounded-full bg-accent/40"
          style={{ animationDelay: `${delay}ms`, animationDuration: '1.4s' }}
        />
      ))}
    </div>
  );
}

function RenderedText({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, li) => {
        const parts = line.split(/(\*[^*\n]+\*|\b\d{1,3}(?:,\d{3})*(?:\.\d+)?%?\b)/g);
        const rendered = parts.map((p, pi) => {
          if (p.startsWith('*') && p.endsWith('*') && p.length > 2)
            return <span key={pi} className="font-semibold text-paper">{p.slice(1, -1)}</span>;
          if (/^\d/.test(p) && p.length > 1)
            return <span key={pi} className="font-medium text-accent">{p}</span>;
          return <span key={pi}>{p}</span>;
        });
        return (
          <span key={li}>
            {rendered}
            {li < lines.length - 1 && <br />}
          </span>
        );
      })}
    </>
  );
}
