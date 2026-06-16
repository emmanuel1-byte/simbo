'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { SqlHighlight } from './sql-highlight';
import { Copy } from '@/components/icons';
import { toast } from 'sonner';
import type { ChatMessage, ExecutionStep } from '@/types';

type Tab = 'sql' | 'timeline' | 'interpretation';

const TABS: { id: Tab; label: string }[] = [
  { id: 'sql',            label: 'SQL' },
  { id: 'timeline',       label: 'Timeline' },
  { id: 'interpretation', label: 'Intent' },
];

interface InspectorProps {
  message?: ChatMessage | null;
  liveSteps?: ExecutionStep[];
}

export function Inspector({ message, liveSteps }: InspectorProps) {
  const [tab, setTab] = useState<Tab>('sql');

  return (
    <aside className="flex h-full flex-col overflow-hidden bg-ink-2">

      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-rule px-5 py-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-paper-3">
          Evidence
        </span>
        {message && (
          <span className="font-mono text-[10px] text-paper-3">
            {message.sql ? 'query ready' : 'processing…'}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-shrink-0 gap-1 border-b border-rule px-3 pt-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'relative px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors',
              tab === t.id ? 'text-paper' : 'text-paper-3 hover:text-paper-2',
            )}
          >
            {t.label}
            {tab === t.id && (
              <span className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-accent" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-5">
        {!message && <InspectorEmpty />}
        {message && tab === 'sql'            && <SqlTab message={message} />}
        {message && tab === 'timeline'       && <TimelineTab steps={liveSteps ?? message.steps ?? []} />}
        {message && tab === 'interpretation' && <InterpretationTab message={message} />}
      </div>

    </aside>
  );
}

// ─── Empty ────────────────────────────────────────────────────────────────────

function InspectorEmpty() {
  return (
    <div className="flex h-full items-center justify-center py-16">
      <div className="text-center">
        <div className="mx-auto mb-3 h-8 w-8 rounded-full border border-rule-2 grid place-items-center">
          <span className="font-mono text-[10px] text-paper-3">S</span>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-paper-3">
          Run a query to inspect it
        </p>
      </div>
    </div>
  );
}

// ─── SQL tab ──────────────────────────────────────────────────────────────────

function SqlTab({ message }: { message: ChatMessage }) {
  const sql = message.sql ?? '';

  return (
    <div className="flex flex-col gap-4">
      <SectionLabel>Generated SQL</SectionLabel>

      <div className="overflow-hidden rounded-md border border-rule-2 bg-ink">
        {/* File bar */}
        <div className="flex items-center border-b border-rule px-4 py-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-paper-3">
            query.sql
          </span>
          <button
            type="button"
            onClick={() => { navigator.clipboard.writeText(sql); toast.success('Copied'); }}
            className="ml-auto flex items-center gap-1.5 rounded-xs border border-rule px-2 py-1 font-mono text-[9px] text-paper-3 transition-colors hover:border-rule-2 hover:text-paper"
            aria-label="Copy SQL"
          >
            <Copy size={10} /> Copy
          </button>
        </div>
        <SqlHighlight code={sql} />
      </div>

      {/* Row count badge */}
      {message.result && (
        <div className="flex items-center gap-3 rounded-sm border border-rule bg-ink px-3 py-2 font-mono text-[10px] text-paper-2">
          <span className="h-1.5 w-1.5 rounded-full bg-ok" />
          {message.result.rowCount ?? message.result.rows.length} rows,{' '}
          {message.result.executionMs ?? 0}ms execution
        </div>
      )}
    </div>
  );
}

// ─── Timeline tab ─────────────────────────────────────────────────────────────

function TimelineTab({ steps }: { steps: ExecutionStep[] }) {
  if (!steps.length) return <InspectorEmpty />;

  const totalMs = steps.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <SectionLabel>Execution timeline</SectionLabel>

      <div className="relative pl-5">
        {/* Track */}
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-rule-2" />

        {steps.map((step) => (
          <div key={step.id} className="relative mb-5 last:mb-0">
            {/* Step dot */}
            <span
              className={cn(
                'absolute -left-[18px] top-[5px] h-[9px] w-[9px] rounded-full border transition-all',
                step.status === 'done'    && 'border-ok bg-ok shadow-[0_0_6px_rgba(62,156,110,0.4)]',
                step.status === 'running' && 'animate-pulse border-accent bg-accent/30',
                step.status === 'pending' && 'border-rule-2 bg-ink-4',
                step.status === 'failed'  && 'border-warn bg-warn',
              )}
            />

            <div className="flex items-baseline gap-2">
              <span className="text-[12px] text-paper">{step.label}</span>
              <span className="font-mono text-[10px] text-paper-3">
                {step.status === 'running'
                  ? 'running'
                  : step.status === 'pending'
                    ? 'queued'
                    : step.durationMs != null
                      ? `${step.durationMs}ms`
                      : ''}
              </span>
            </div>

            {step.description && (
              <p className="mt-0.5 text-[11px] leading-relaxed text-paper-2">
                {step.description}
              </p>
            )}

            {/* Duration bar */}
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
      </div>

      {totalMs > 0 && (
        <div className="flex items-center gap-2 border-t border-rule pt-4">
          <span className="label-eyebrow">Total</span>
          <span className="font-mono text-[13px] font-medium text-accent">{totalMs}ms</span>
        </div>
      )}
    </div>
  );
}

// ─── Interpretation tab ───────────────────────────────────────────────────────

function InterpretationTab({ message }: { message: ChatMessage }) {
  const intent = message.intent;
  if (!intent) return <InspectorEmpty />;

  const colorMap = {
    table:  'border-accent/30 text-accent/80',
    filter: 'border-info/30 text-info/80',
    agg:    'border-caution/30 text-caution/80',
    range:  'border-rule-2 text-paper-2',
    group:  'border-rule-2 text-paper-2',
  } as const;

  return (
    <div className="flex flex-col gap-4">
      <SectionLabel>Interpreted intent</SectionLabel>
      <p className="font-serif text-[16px] font-normal leading-[1.6] tracking-[-0.01em] text-paper">
        {intent.description}
      </p>
      {intent.entities.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {intent.entities.map((e, i) => (
            <span
              key={i}
              className={cn('rounded-xs border px-2.5 py-1 font-mono text-[9px] tracking-wide', colorMap[e.kind])}
            >
              {e.kind}: {e.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-paper-3">
      {children}
    </div>
  );
}
