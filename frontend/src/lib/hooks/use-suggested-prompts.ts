'use client';

import { useEffect, useState } from 'react';
import { connectionsApi } from '@/lib/api';

export type PromptKind = 'growth' | 'retention' | 'revenue' | 'ops';

export interface SuggestedPrompt {
  kind: PromptKind;
  text: string;
}

interface SchemaColumn { name: string; type: string; nullable: boolean; }
interface SchemaTable  { name: string; columns: SchemaColumn[]; }

// Shown when no connection is selected — intentionally generic.
const FALLBACK: SuggestedPrompt[] = [
  { kind: 'growth',    text: 'Connect a database to generate suggested questions.' },
  { kind: 'retention', text: 'Your suggestions will be based on your actual tables.' },
  { kind: 'revenue',   text: 'Each prompt references real column names from your schema.' },
  { kind: 'ops',       text: 'Add a database connection to get started.' },
];

// Column-name patterns → semantic category
const COL_DATE    = ['created_at', 'updated_at', 'deleted_at', 'signup_at', 'registered_at', 'timestamp', 'date', 'occurred_at', 'inserted_at'];
const COL_AMOUNT  = ['amount', 'total', 'price', 'cost', 'revenue', 'value', 'subtotal', 'gross', 'net', 'fee', 'balance', 'charge'];
const COL_STATUS  = ['status', 'state', 'stage', 'type', 'category'];
const COL_USER_FK = ['user_id', 'customer_id', 'account_id', 'member_id', 'subscriber_id', 'contact_id', 'person_id'];
const COL_ACTIVE  = ['last_active_at', 'last_seen_at', 'last_login_at', 'last_activity_at', 'active_at', 'last_visited_at'];

function hasCol(table: SchemaTable, patterns: string[]): boolean {
  return table.columns.some((c) => patterns.some((p) => c.name.toLowerCase().includes(p)));
}

function colName(table: SchemaTable, patterns: string[]): string | null {
  const c = table.columns.find((c) => patterns.some((p) => c.name.toLowerCase().includes(p)));
  return c?.name ?? null;
}

function buildPrompts(tables: SchemaTable[]): SuggestedPrompt[] {
  const prompts: SuggestedPrompt[] = [];
  const used = new Set<string>();

  function push(p: SuggestedPrompt) {
    if (prompts.length < 4 && !used.has(p.text)) {
      prompts.push(p);
      used.add(p.text);
    }
  }

  for (const t of tables) {
    if (prompts.length >= 4) break;
    const tbl = t.name;
    const hasDate   = hasCol(t, COL_DATE);
    const hasAmount = hasCol(t, COL_AMOUNT);
    const hasStatus = hasCol(t, COL_STATUS);
    const hasFk     = hasCol(t, COL_USER_FK);
    const hasActive = hasCol(t, COL_ACTIVE);
    const amtCol    = colName(t, COL_AMOUNT) ?? 'amount';
    const stsCol    = colName(t, COL_STATUS) ?? 'status';

    // Growth: tables with a date column (sign-up tracking, creation rate, etc.)
    if (hasDate && !hasAmount) {
      push({ kind: 'growth', text: `How many ${tbl} were created this week vs. last week?` });
      push({ kind: 'growth', text: `Show me the daily count of new ${tbl} over the last 30 days.` });
    }

    // Revenue: tables with monetary columns
    if (hasAmount && hasDate) {
      push({ kind: 'revenue', text: `Total ${amtCol} in ${tbl} this month, broken down by week.` });
      push({ kind: 'revenue', text: `Top 10 ${hasFk ? 'customers' : 'rows'} by ${amtCol} in ${tbl} this quarter.` });
    }

    // Retention: tables with last-active columns
    if (hasActive) {
      const activeCol = colName(t, COL_ACTIVE)!;
      push({ kind: 'retention', text: `Which ${tbl} haven't had activity (${activeCol}) in the last 30 days?` });
    }

    // Ops: tables with status enums
    if (hasStatus && hasDate) {
      push({ kind: 'ops', text: `Breakdown of ${tbl} by ${stsCol} this month.` });
    }

    // Fallback: any table with enough columns gets a generic count prompt
    if (t.columns.length >= 2) {
      push({ kind: 'ops', text: `How many rows are currently in ${tbl}?` });
    }
  }

  return prompts.length >= 2 ? prompts : FALLBACK;
}

export function useSuggestedPrompts(connectionId?: string | null) {
  const [prompts, setPrompts] = useState<SuggestedPrompt[]>(FALLBACK);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!connectionId) {
      setPrompts(FALLBACK);
      return;
    }
    let cancelled = false;
    setLoading(true);

    connectionsApi
      .getSchema(connectionId)
      .then((tables: SchemaTable[]) => {
        if (cancelled) return;
        setPrompts(buildPrompts(tables));
      })
      .catch(() => {
        if (!cancelled) setPrompts(FALLBACK);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [connectionId]);

  return { prompts, loading };
}
