'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppTopbar } from '@/components/app/app-topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/modal';
import { EmptyState, NoHistoryIllustration, NoSearchResultsIllustration } from '@/components/empty-states/empty-state';
import { ArrowRight, Plus, Search, Trash } from '@/components/icons';
import { queriesApi } from '@/lib/api';
import { formatRelative } from '@/lib/utils/format';
import { useWorkspaceName } from '@/lib/hooks/use-workspace-name';
import { toast } from 'sonner';
import type { Conversation } from '@/types';

export default function HistoryPage() {
  const router = useRouter();
  const workspaceName = useWorkspaceName();
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [query, setQuery]                 = useState('');
  const [confirmTarget, setConfirmTarget] = useState<Conversation | null>(null);
  const [deleting, setDeleting]           = useState(false);

  useEffect(() => {
    queriesApi.listConversations().then(setConversations).catch(() => setConversations([]));
  }, []);

  const filtered = useMemo(() => {
    if (!conversations) return null;
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, query]);

  async function handleConfirmDelete() {
    if (!confirmTarget) return;
    setDeleting(true);
    const id = confirmTarget.id;
    setConversations((prev) => prev?.filter((c) => c.id !== id) ?? null);
    try {
      await queriesApi.deleteConversation(id);
      toast.success('Deleted');
    } catch {
      toast.error('Could not delete. Try again.');
    } finally {
      setDeleting(false);
      setConfirmTarget(null);
    }
  }

  return (
    <>
      <AppTopbar crumb={workspaceName} title="History" />

      <main className="mx-auto w-full max-w-[800px] flex-1 overflow-auto px-8 py-10">

        {/* Page header */}
        <div className="mb-10 flex items-end justify-between gap-6">
          <div>
            <div className="label-eyebrow mb-3">Query history</div>
            <h1 className="font-serif text-[36px] font-normal leading-[1.05] tracking-[-0.025em] text-paper">
              Everything you&rsquo;ve{' '}
              <em className="text-accent" style={{ fontStyle: 'italic' }}>asked.</em>
            </h1>
          </div>
          <Button
            variant="primary"
            size="sm"
            iconLeft={<Plus size={12} />}
            onClick={() => router.push('/ask')}
          >
            New query
          </Button>
        </div>

        {/* Search */}
        <div className="mb-8 max-w-[360px]">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations…"
            iconLeft={<Search size={14} />}
          />
        </div>

        {/* Loading */}
        {!conversations && (
          <div className="flex flex-col">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border-b border-rule py-4">
                <Skeleton className="mb-2 h-4 w-2/3 rounded-sm" />
                <Skeleton className="h-3 w-1/4 rounded-sm" />
              </div>
            ))}
          </div>
        )}

        {/* Empty — no conversations */}
        {conversations && conversations.length === 0 && (
          <div className="grid place-items-center pt-20">
            <EmptyState
              illustration={<NoHistoryIllustration />}
              eyebrow="nothing here yet"
              title="Your history is empty."
              description="Run your first query and Simbo will keep it here."
              action={
                <Button variant="primary" iconRight={<ArrowRight size={13} />} onClick={() => router.push('/ask')}>
                  Ask your first question
                </Button>
              }
            />
          </div>
        )}

        {/* Empty — search */}
        {filtered && filtered.length === 0 && conversations!.length > 0 && (
          <div className="grid place-items-center pt-20">
            <EmptyState
              illustration={<NoSearchResultsIllustration />}
              title={<>No results for &ldquo;{query}&rdquo;</>}
              description="Try a broader phrase, or clear the search."
              action={<Button variant="secondary" onClick={() => setQuery('')}>Clear search</Button>}
            />
          </div>
        )}

        {/* Conversation list */}
        {filtered && filtered.length > 0 && (
          <ul className="flex flex-col">
            {filtered.map((c) => (
              <li
                key={c.id}
                className="group flex items-center gap-4 border-b border-rule py-4 transition-colors first:border-t hover:bg-ink-3/50"
              >
                <Link href={`/chat/${c.id}`} className="min-w-0 flex-1 py-0.5">
                  <div className="truncate text-[14px] font-medium text-paper/90 transition-colors group-hover:text-paper">
                    {c.title}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-paper-3">
                    <span>{formatRelative(c.updatedAt)}</span>
                    {c.connectionName && (
                      <>
                        <span className="opacity-40">·</span>
                        <span>{c.connectionName}</span>
                      </>
                    )}
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => setConfirmTarget(c)}
                  aria-label="Delete conversation"
                  className="opacity-0 text-paper-3 transition-all hover:text-warn group-hover:opacity-100"
                >
                  <Trash size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      <ConfirmDialog
        open={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        destructive
        title={<>Delete &ldquo;{confirmTarget?.title}&rdquo;?</>}
        description="This conversation and its results will be permanently removed."
        confirmLabel="Delete"
      />
    </>
  );
}
