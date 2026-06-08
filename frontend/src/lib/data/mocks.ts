/**
 * Static mock data used when NEXT_PUBLIC_USE_MOCKS=true.
 * Rich enough to make every screen feel alive without a backend.
 */

import type { ChatMessage, DbConnection, User } from '@/types';

export const mockUser: User = {
  id: 'usr_01H9X2',
  email: 'emmanuel@workrity.com',
  name: 'Emmanuel',
  verified: true,
  createdAt: '2025-09-12T10:14:00Z',
};

export const mockConnections: DbConnection[] = [
  {
    id: 'conn_pg_prod',
    name: 'production · postgres',
    provider: 'postgres',
    host: 'read-replica-1.acme.internal',
    database: 'acme_prod',
    port: 5432,
    useTls: true,
    status: 'connected',
    tableCount: 14,
    lastSyncedAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    createdAt: '2025-12-01T08:00:00Z',
  },
  {
    id: 'conn_mysql_anal',
    name: 'analytics · mysql',
    provider: 'mysql',
    host: 'analytics.acme.local',
    database: 'analytics',
    port: 3306,
    useTls: false,
    status: 'connected',
    tableCount: 22,
    lastSyncedAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    createdAt: '2026-01-10T12:00:00Z',
  },
  {
    id: 'conn_snow',
    name: 'warehouse · snowflake',
    provider: 'snowflake',
    host: 'acme.snowflakecomputing.com',
    database: 'WAREHOUSE',
    port: 443,
    useTls: true,
    status: 'pending',
    tableCount: 0,
    createdAt: '2026-04-22T09:00:00Z',
  },
];

const sampleSql = `-- read-only · validated · safe-mode
SELECT
  date_trunc('week', created_at) AS week,
  count(*)                       AS signups,
  count(DISTINCT id)             AS active
FROM users
WHERE created_at >= now() - INTERVAL '14 days'
  AND status = 'active'
GROUP BY 1
ORDER BY 1 DESC;`;

export const sampleAssistantMessage: ChatMessage = {
  id: 'msg_a1',
  role: 'assistant',
  content:
    "Last week saw 1,284 new active users — a 17.6% lift over the prior week's 1,092. Tuesday was the strongest day in both weeks.",
  createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  status: 'done',
  intent: {
    description:
      'Compare weekly active signups for the last completed week vs the week before, on the production users table.',
    entities: [
      { kind: 'table', label: 'users' },
      { kind: 'filter', label: "status = 'active'" },
      { kind: 'agg', label: 'count distinct' },
      { kind: 'range', label: '14d' },
      { kind: 'group', label: 'week' },
    ],
  },
  sql: sampleSql,
  result: {
    columns: ['week', 'signups', 'active', 'vs_prior'],
    rows: [
      ['2026-04-20 → 04-26', 1284, 971, '+17.6%'],
      ['2026-04-13 → 04-19', 1092, 812, '—'],
    ],
    rowCount: 2,
    executionMs: 238,
    cached: true,
  },
  steps: [
    { id: 's1', label: 'Parse intent', description: 'Identified entities, time window, aggregation.', durationMs: 41, status: 'done' },
    { id: 's2', label: 'Generate SQL', description: 'Two-pass generation. Validated against information_schema.', durationMs: 612, status: 'done' },
    { id: 's3', label: 'Validate guardrails', description: 'No mutations. Estimated row scan: 14k. Within budget.', durationMs: 8, status: 'done' },
    { id: 's4', label: 'Execute on production', description: 'Connection: read-replica-1.', durationMs: 238, status: 'done' },
    { id: 's5', label: 'Summarize result', durationMs: 320, status: 'done' },
  ],
};

export const mockConversations = [
  {
    id: 'conv_8a23f',
    title: 'Weekly signup comparison',
    connectionId: 'conn_pg_prod',
    connectionName: 'production · postgres',
    connectionDbType: 'postgres',
    createdAt: new Date(Date.now() - 1000 * 60 * 6).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: 'conv_72k2',
    title: 'Top 10 customers by LTV',
    connectionId: 'conn_pg_prod',
    connectionName: 'production · postgres',
    connectionDbType: 'postgres',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
  },
  {
    id: 'conv_44s1',
    title: 'Average ticket response time',
    connectionId: 'conn_mysql_anal',
    connectionName: 'analytics · mysql',
    connectionDbType: 'mysql',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
  },
  {
    id: 'conv_91p9',
    title: 'Cohort retention by signup month',
    connectionId: 'conn_pg_prod',
    connectionName: 'production · postgres',
    connectionDbType: 'postgres',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
  },
];

export const suggestedPrompts = [
  { kind: 'growth', text: 'How did weekly signups change over the last 30 days?' },
  { kind: 'retention', text: 'Which cohort has the highest 30-day return rate?' },
  { kind: 'revenue', text: 'Top 10 customers by lifetime value, this year.' },
  { kind: 'ops', text: 'Average response time on support tickets last month.' },
] as const;
