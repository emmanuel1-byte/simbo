'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppTopbar } from '@/components/app/app-topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/modal';
import {
  EmptyState,
  NoHistoryIllustration,
  NoSearchResultsIllustration,
} from '@/components/empty-states/empty-state';
import { ArrowRight, Bookmark, Clock, Plus, Search, Trash } from '@/components/icons';
import { queriesApi } from '@/lib/api';
import { formatRelative } from '@/lib/utils/format';
import { toast } from 'sonner';
import type { Conversation } from '@/types';

export default function HistoryPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [query, setQuery] = useState('');
  const [confirmTarget, setConfirmTarget] = useState<Conversation | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    queriesApi.listConversations().then(setConversations);
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
      toast.success('Conversation deleted');
    } catch {
      toast.error('Could not delete. Try again.');
    } finally {
      setDeleting(false);
      setConfirmTarget(null);
    }
  }

  return (
    <>
      <AppTopbar crumb="workspace · acme analytics" title="History" />

      <main className="mx-auto w-full max-w-[960px] flex-1 overflow-auto px-8 py-10">
        <div className="mb-8 flex items-end justify-between gap-6 flex-wrap">
          <div>
            <div className="label-eyebrow mb-2">queries / your library</div>
            <h1 className="m-0 font-serif text-4xl font-light leading-[1.05] tracking-[-0.02em] text-paper">
              Everything you've{' '}
              <em className="text-accent" style={{ fontStyle: 'italic' }}>
                ever asked.
              </em>
            </h1>
          </div>
          <Button
            variant="primary"
            iconLeft={<Plus size={14} />}
            onClick={() => router.push('/ask')}
          >
            New query
          </Button>
        </div>

        <div className="mb-6 max-w-[400px]">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your past queries…"
            iconLeft={<Search size={16} />}
          />
        </div>

        {/* Loading */}
        {!conversations && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        )}

        {/* Empty (no conversations at all) */}
        {conversations && conversations.length === 0 && (
          <div className="grid place-items-center pt-16">
            <EmptyState
              illustration={<NoHistoryIllustration />}
              eyebrow="quiet on the western front"
              title={
                <>
                  Your history is{' '}
                  <em className="text-accent" style={{ fontStyle: 'italic' }}>
                    empty
                  </em>{' '}
                  — for now.
                </>
              }
              description="Run your first query and Simbo will keep it here, ready to re-run, refine, or share with your team."
              action={
                <Button
                  variant="primary"
                  iconRight={<ArrowRight size={14} />}
                  onClick={() => router.push('/ask')}
                >
                  Ask your first question
                </Button>
              }
            />
          </div>
        )}

        {/* Empty (search) */}
        {filtered && filtered.length === 0 && conversations!.length > 0 && (
          <div className="grid place-items-center pt-16">
            <EmptyState
              illustration={<NoSearchResultsIllustration />}
              title={
                <>
                  Nothing matches{' '}
                  <em className="text-accent" style={{ fontStyle: 'italic' }}>
                    "{query}"
                  </em>
                </>
              }
              description="Try a broader phrase, or clear the search to see everything."
              action={
                <Button variant="secondary" onClick={() => setQuery('')}>
                  Clear search
                </Button>
              }
            />
          </div>
        )}

        {/* List */}
        {filtered && filtered.length > 0 && (
          <ul className="flex flex-col gap-2">
            {filtered.map((c) => (
              <li
                key={c.id}
                className="group flex items-center gap-4 rounded-xl border border-rule bg-ink-2 px-5 py-4 transition-all hover:border-rule-2"
              >
                <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-ink-4 text-muted">
                  <Clock size={16} />
                </span>
                <Link
                  href={`/chat/${c.id}`}
                  className="min-w-0 flex-1"
                >
                  <div className="flex items-center gap-2.5">
                    <b className="truncate font-medium text-paper">{c.title}</b>
                    {c.pinned && <Bookmark size={12} className="text-accent" />}
                  </div>
                  <div className="font-mono text-2xs uppercase tracking-[0.12em] text-muted">
                    {formatRelative(c.updatedAt)} · {c.messages.length || '–'} message
                    {c.messages.length === 1 ? '' : 's'}
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => setConfirmTarget(c)}
                  aria-label="Delete conversation"
                  className="grid h-8 w-8 place-items-center rounded-md border border-transparent text-muted opacity-0 transition-all hover:border-warn/40 hover:text-warn group-hover:opacity-100"
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
        title={
          <>
            Delete{' '}
            <em className="text-accent" style={{ fontStyle: 'italic' }}>
              "{confirmTarget?.title}"
            </em>
            ?
          </>
        }
        description="This conversation and its results will be permanently removed. You'll be able to ask the same question again, but the saved answer will be gone."
        confirmLabel="Delete forever"
      />
    </>
  );
}
