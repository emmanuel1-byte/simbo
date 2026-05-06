'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { SqlHighlight } from './sql-highlight';
import { Copy, FileText } from '@/components/icons';
import { toast } from 'sonner';
import type { ChatMessage, ExecutionStep } from '@/types';

type Tab = 'interpretation' | 'sql' | 'timeline';

interface InspectorProps {
  message?: ChatMessage | null;
  liveSteps?: ExecutionStep[];
}

const TABS: { id: Tab; label: string; n: number }[] = [
  { id: 'interpretation', label: 'Interpretation', n: 1 },
  { id: 'sql', label: 'SQL', n: 2 },
  { id: 'timeline', label: 'Timeline', n: 3 },
];

export function Inspector({ message, liveSteps }: InspectorProps) {
  const [tab, setTab] = useState<Tab>('sql');

  return (
    <aside className="grid grid-rows-[auto_1fr] overflow-hidden bg-ink-2">
      <div className="flex border-b border-rule px-5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'relative flex items-center gap-2 py-[18px] px-4 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors',
              tab === t.id ? 'text-paper' : 'text-muted hover:text-paper',
            )}
          >
            <span
              className={cn(
                'rounded px-1.5 py-0.5 font-mono text-[9px]',
                tab === t.id ? 'bg-accent text-ink' : 'bg-ink-4 text-paper',
              )}
            >
              {t.n}
            </span>
            {t.label}
            {tab === t.id && (
              <span className="absolute inset-x-4 -bottom-px h-0.5 bg-accent" />
            )}
          </button>
        ))}
      </div>

      <div className="overflow-auto px-7 py-6">
        {!message ? <InspectorEmpty /> : null}

        {message && tab === 'interpretation' && (
          <InterpretationTab message={message} />
        )}
        {message && tab === 'sql' && <SqlTab message={message} />}
        {message && tab === 'timeline' && (
          <TimelineTab steps={liveSteps ?? message.steps ?? []} />
        )}
      </div>
    </aside>
  );
}

function InspectorEmpty() {
  return (
    <div className="grid h-full place-items-center text-center">
      <div className="max-w-[280px] animate-fade-in">
        <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-xl border border-rule bg-ink text-muted">
          <FileText size={20} />
        </div>
        <p className="font-mono text-2xs uppercase tracking-[0.16em] text-muted">
          ask a question to see
        </p>
        <p className="mt-1.5 font-serif text-lg text-paper" style={{ fontStyle: 'italic' }}>
          how Simbo thinks.
        </p>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-3 font-mono text-2xs font-normal uppercase tracking-[0.18em] text-muted">
      {children}
    </h4>
  );
}

function InterpretationTab({ message }: { message: ChatMessage }) {
  const intent = message.intent;
  if (!intent) return <InspectorEmpty />;
  const colorMap = {
    table: 'border-accent/35 text-accent',
    filter: 'border-[rgba(124,158,255,0.35)] text-[#7c9eff]',
    agg: 'border-[rgba(255,156,124,0.35)] text-[#ff9c7c]',
    range: 'border-rule text-paper',
    group: 'border-rule text-paper',
  } as const;
  return (
    <>
      <SectionLabel>Interpreted intent</SectionLabel>
      <div className="rounded-xl border border-rule bg-ink p-5">
        <p className="m-0 font-serif text-lg font-light leading-[1.4] text-paper">
          {intent.description}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {intent.entities.map((e, i) => (
            <span
              key={i}
              className={cn(
                'rounded border bg-transparent px-2.5 py-1 font-mono text-[10px] tracking-wide',
                colorMap[e.kind],
              )}
            >
              {e.kind} · {e.label}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}

function SqlTab({ message }: { message: ChatMessage }) {
  const sql = message.sql ?? '';
  return (
    <>
      <SectionLabel>Generated SQL</SectionLabel>
      <div className="overflow-hidden rounded-xl border border-rule bg-ink">
        <div className="flex items-center gap-2.5 border-b border-rule px-3.5 py-2.5">
          <span className="font-mono text-[11px] text-muted">query.sql</span>
          <span className="font-mono text-[11px] text-muted">postgres dialect</span>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(sql);
              toast.success('SQL copied to clipboard');
            }}
            className="ml-auto grid h-7 w-7 place-items-center rounded-md border border-rule text-muted transition-colors hover:border-paper hover:text-paper"
            aria-label="Copy SQL"
          >
            <Copy size={12} />
          </button>
        </div>
        <SqlHighlight code={sql} />
      </div>
    </>
  );
}

function TimelineTab({ steps }: { steps: ExecutionStep[] }) {
  if (!steps.length) return <InspectorEmpty />;
  return (
    <>
      <SectionLabel>Execution timeline</SectionLabel>
      <div className="relative pl-6">
        <div className="absolute left-[7px] top-1.5 bottom-1.5 w-px bg-rule" />
        {steps.map((step) => (
          <div key={step.id} className="relative pb-5">
            <span
              className={cn(
                'absolute -left-[19px] top-1.5 h-[9px] w-[9px] rounded-full border-2',
                step.status === 'done' && 'border-accent bg-accent',
                step.status === 'running' && 'animate-pulse-accent border-accent bg-ink',
                step.status === 'pending' && 'border-rule bg-ink',
                step.status === 'failed' && 'border-warn bg-warn',
              )}
              style={
                step.status === 'done'
                  ? { boxShadow: '0 0 8px #d3ff3a' }
                  : undefined
              }
            />
            <div className="flex items-baseline gap-2.5 font-mono text-[12px] text-paper">
              {step.label}
              <small className="font-mono text-2xs text-muted">
                {step.status === 'running'
                  ? '· running…'
                  : step.status === 'pending'
                    ? '· pending'
                    : step.durationMs != null
                      ? `· ${step.durationMs}ms`
                      : ''}
              </small>
            </div>
            {step.description && (
              <p className="mt-1 max-w-[380px] text-[12px] text-muted">
                {step.description}
              </p>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
