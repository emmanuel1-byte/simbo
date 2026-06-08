'use client';

import { Card } from '@/components/ui/surface';
import { SettingsHeader } from '@/components/app/settings-header';

const guardrails = [
  {
    id: 'block_writes',
    name: 'Write blocking',
    description: 'INSERT, UPDATE, DELETE, DROP and TRUNCATE are rejected at the parser level before reaching your database.',
  },
  {
    id: 'heavy_query_warn',
    name: 'Heavy-query protection',
    description: 'Queries that would scan more than 1M rows are flagged and cancelled automatically.',
  },
  {
    id: 'query_timeout',
    name: 'Query timeout',
    description: 'Any query running longer than 30 seconds is cancelled to protect your database.',
  },
  {
    id: 'pii_redaction',
    name: 'PII redaction',
    description: 'Emails, phone numbers and names are masked before they appear in Simbo\'s internal logs.',
  },
];

export default function SecurityPage() {
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
        lead="Simbo is engineered so that no query can mutate your data — by configuration and by design."
      />

      <Card>
        <h4 className="m-0 mb-1 text-[15px] font-medium text-paper">Always-on guardrails</h4>
        <p className="m-0 mb-5 text-[12.5px] text-muted">
          These protections are enforced server-side and cannot be disabled.
        </p>
        <div>
          {guardrails.map((g, i) => (
            <div
              key={g.id}
              className={`flex items-start gap-3.5 py-3.5 ${i > 0 ? 'border-t border-rule' : ''}`}
            >
              <span className="mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded-full bg-accent/15 font-mono text-[10px] font-bold text-accent">
                ✓
              </span>
              <div>
                <b className="block text-[13px] font-medium text-paper">{g.name}</b>
                <small className="font-mono text-[11px] text-muted">{g.description}</small>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
