'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/surface';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/ui/pill';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/modal';
import { SettingsHeader } from '@/components/app/settings-header';
import { AddConnectionModal } from '@/components/app/add-connection-modal';
import { EmptyState, NoConnectionsIllustration } from '@/components/empty-states/empty-state';
import { connectionsApi } from '@/lib/api';
import { Plus, Refresh } from '@/components/icons';
import { toast } from 'sonner';
import { formatRelative } from '@/lib/utils/format';
import type { DbConnection } from '@/types';

const providerStyle: Record<DbConnection['provider'], { mark: string; bg: string; color: string }> = {
  postgres: { mark: 'PG', bg: '#336791', color: '#fff' },
  mysql: { mark: 'My', bg: '#00758f', color: '#fff' },
  snowflake: { mark: 'Sn', bg: '#29b5e8', color: '#fff' },
  bigquery: { mark: 'BQ', bg: '#4285f4', color: '#fff' },
  sqlite: { mark: 'Lt', bg: '#003b57', color: '#fff' },
};

function ConnectionsPageInner() {
  const searchParams = useSearchParams();
  const [connections, setConnections] = useState<DbConnection[] | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<DbConnection | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    try {
      setConnections(await connectionsApi.list());
    } catch {
      setConnections([]);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  // Honor `?new=1` query param (used by command palette + onboarding)
  useEffect(() => {
    if (searchParams.get('new') === '1') setShowAdd(true);
  }, [searchParams]);

  async function handleTest(id: string) {
    setTestingId(id);
    try {
      const r = await connectionsApi.test(id);
      toast.success(`Connected · ${r.tableCount ?? 0} tables`);
      void load(); // refresh list so status flips to 'connected'
    } catch {
      toast.error('Connection failed. Check credentials and host.');
    } finally {
      setTestingId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    const id = confirmDelete.id;
    setConnections((p) => p?.filter((c) => c.id !== id) ?? null);
    try {
      await connectionsApi.remove(id);
      toast.success('Connection removed');
    } catch {
      toast.error('Could not remove connection');
      void load();
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  }

  return (
    <>
      <SettingsHeader
        title={
          <>
            Database{' '}
            <em className="text-accent" style={{ fontStyle: 'italic' }}>
              connections.
            </em>
          </>
        }
        lead="All connections use TLS. Use a read-replica role wherever possible — Simbo is built to read, not write."
      />

      <div className="mb-5 flex justify-end">
        <Button
          variant="primary"
          size="sm"
          iconLeft={<Plus size={14} />}
          onClick={() => setShowAdd(true)}
        >
          Add connection
        </Button>
      </div>

      {!connections && (
        <Card>
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        </Card>
      )}

      {connections && connections.length === 0 && (
        <Card>
          <div className="grid place-items-center py-10">
            <EmptyState
              illustration={<NoConnectionsIllustration />}
              eyebrow="no databases yet"
              title={
                <>
                  Plug in a{' '}
                  <em className="text-accent" style={{ fontStyle: 'italic' }}>
                    database
                  </em>{' '}
                  to begin.
                </>
              }
              description="Simbo connects via read-only credentials. Postgres, MySQL, Snowflake, and BigQuery are supported out of the box."
              action={
                <Button
                  variant="primary"
                  iconLeft={<Plus size={14} />}
                  onClick={() => setShowAdd(true)}
                >
                  Add your first connection
                </Button>
              }
            />
          </div>
        </Card>
      )}

      {connections && connections.length > 0 && (
        <Card>
          {connections.map((c, i) => {
            const style = providerStyle[c.provider];
            return (
              <div
                key={c.id}
                className={`flex items-center gap-4 py-3.5 ${i > 0 ? 'border-t border-rule' : ''}`}
              >
                <div
                  className="grid h-[34px] w-[34px] flex-shrink-0 place-items-center rounded-md font-mono text-[13px] font-bold"
                  style={{ background: style.bg, color: style.color }}
                >
                  {style.mark}
                </div>
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-sm">{c.name}</b>
                  <small className="block font-mono text-[11px] text-muted">
                    {c.host}
                    {c.tableCount ? ` · ${c.tableCount} tables` : ''}
                    {c.lastSyncedAt ? ` · last sync ${formatRelative(c.lastSyncedAt)}` : ''}
                  </small>
                </div>
                {c.status === 'connected' ? (
                  <Pill variant="safe">connected</Pill>
                ) : c.status === 'pending' ? (
                  <Pill variant="warn">action needed</Pill>
                ) : (
                  <Pill variant="warn">error</Pill>
                )}
                {c.status === 'connected' ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleTest(c.id)}
                    loading={testingId === c.id}
                    iconLeft={<Refresh size={12} />}
                  >
                    Test
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleTest(c.id)}
                    loading={testingId === c.id}
                  >
                    Authorize
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmDelete(c)}
                  className="text-warn"
                >
                  Remove
                </Button>
              </div>
            );
          })}
        </Card>
      )}

      <AddConnectionModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={(c) => setConnections((p) => (p ? [c, ...p] : [c]))}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        destructive
        title={
          <>
            Remove{' '}
            <em className="text-accent" style={{ fontStyle: 'italic' }}>
              {confirmDelete?.name}
            </em>
            ?
          </>
        }
        description="This disconnects Simbo from the database immediately. Past query results stay visible to you, but new queries against this connection will fail until you re-add it."
        confirmLabel="Yes, remove"
      />
    </>
  );
}

export default function ConnectionsPage() {
  return (
    <Suspense fallback={null}>
      <ConnectionsPageInner />
    </Suspense>
  );
}
