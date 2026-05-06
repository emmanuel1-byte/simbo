'use client';

import { useState } from 'react';
import { Card, Toggle } from '@/components/ui/surface';
import { SettingsHeader } from '@/components/app/settings-header';
import { toast } from 'sonner';

interface GuardrailItem {
  id: string;
  name: string;
  description: string;
  defaultValue: boolean;
  /** When true, this toggle cannot be turned off (core safety). */
  locked?: boolean;
}

const guardrails: GuardrailItem[] = [
  {
    id: 'block_writes',
    name: 'Block writes',
    description: 'INSERT / UPDATE / DELETE / DROP / TRUNCATE — Simbo refuses these at the parser level.',
    defaultValue: true,
    locked: true,
  },
  {
    id: 'heavy_query_warn',
    name: 'Heavy-query warning',
    description: 'Warn before scans larger than 1M rows so you don\u2019t accidentally tax production.',
    defaultValue: true,
  },
  {
    id: 'query_timeout',
    name: 'Query timeout',
    description: 'Cancel any query that runs longer than 30 seconds.',
    defaultValue: true,
  },
  {
    id: 'pii_redaction',
    name: 'PII redaction in logs',
    description: 'Mask emails, phones, names, and other identifiers before they reach our logs.',
    defaultValue: false,
  },
];

export default function SecurityPage() {
  const [values, setValues] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(guardrails.map((g) => [g.id, g.defaultValue])),
  );

  function handleToggle(id: string, locked?: boolean) {
    if (locked) {
      toast.info("This one is locked on. It's part of Simbo's core safety promise.");
      return;
    }
    setValues((v) => ({ ...v, [id]: !v[id] }));
    // TODO(BE): PATCH /workspace/security { [id]: !current }
    toast.success(`${guardrails.find((g) => g.id === id)?.name} updated`);
  }

  return (
    <>
      <SettingsHeader
        title={
          <>
            Security &amp;{' '}
            <em className="text-accent" style={{ fontStyle: 'italic' }}>
              read-only assurance.
            </em>
          </>
        }
        lead="Simbo is engineered so that no query can mutate your data — by configuration and by design. Review the guardrails below."
      />

      <Card>
        <h4 className="m-0 mb-1 text-[15px] font-medium text-paper">Read-only enforcement</h4>
        <p className="m-0 mb-5 text-[12.5px] text-muted">
          Every generated query is parsed and re-validated server-side before reaching your database.
        </p>
        <div>
          {guardrails.map((g, i) => (
            <div
              key={g.id}
              className={`flex items-center gap-4 py-3 ${i > 0 ? 'border-t border-rule' : ''}`}
            >
              <div className="flex-1">
                <b className="block font-mono text-[12px] text-paper">{g.name}</b>
                <small className="font-mono text-[11px] text-muted">{g.description}</small>
              </div>
              <Toggle
                checked={values[g.id]}
                onChange={() => handleToggle(g.id, g.locked)}
                label={g.name}
              />
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-5">
        <h4 className="m-0 mb-1 text-[15px] font-medium text-paper">Audit log</h4>
        <p className="m-0 mb-5 text-[12.5px] text-muted">
          Every query, login, and configuration change is recorded. Available for the last 90 days.
        </p>
        <div className="flex items-center gap-4">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-ink-4 font-mono text-[12px] text-accent">
            ✓
          </div>
          <div className="flex-1">
            <b className="block font-mono text-[12px] text-paper">Audit log enabled</b>
            <small className="font-mono text-[11px] text-muted">
              Streaming to your workspace · 1,284 events this month
            </small>
          </div>
          <button
            type="button"
            onClick={() => toast.info('Opening audit log…')}
            className="font-mono text-[12px] text-accent transition-opacity hover:opacity-80"
          >
            View →
          </button>
        </div>
      </Card>
    </>
  );
}
