'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/modal';
import {
  ArrowRight,
  Clock,
  Database,
  Key,
  MessageSquare,
  Plus,
  Search,
  Settings as SettingsIcon,
  Shield,
  User as UserIcon,
} from '@/components/icons';
import { cn } from '@/lib/utils/cn';
import { queriesApi } from '@/lib/api';
import type { Conversation } from '@/types';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

interface CommandItem {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ size?: number }>;
  action: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);

  // Reset state when reopened
  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelectedIdx(0);
    } else {
      // Lazy-load recent conversations for in-palette search
      queriesApi.listConversations().then((c) => setConversations(c.slice(0, 8)));
    }
  }, [open]);

  // Build the command list
  const commands: CommandItem[] = useMemo(() => {
    const go = (path: string) => () => {
      router.push(path);
      onClose();
    };
    return [
      { id: 'ask', group: 'Go to', label: 'Ask a question', hint: 'Home', icon: MessageSquare, action: go('/ask') },
      { id: 'history', group: 'Go to', label: 'History', hint: 'Past conversations', icon: Clock, action: go('/history') },
      { id: 'profile', group: 'Settings', label: 'Profile', icon: UserIcon, action: go('/settings/profile') },
      { id: 'connections', group: 'Settings', label: 'Connections', icon: Database, action: go('/settings/connections') },
      { id: 'api-key', group: 'Settings', label: 'API key', icon: Key, action: go('/settings/api-key') },
      { id: 'security', group: 'Settings', label: 'Security', icon: Shield, action: go('/settings/security') },
      {
        id: 'new-conn',
        group: 'Actions',
        label: 'Add new connection',
        icon: Plus,
        action: () => {
          router.push('/settings/connections?new=1');
          onClose();
        },
      },
      ...conversations.map((c) => ({
        id: 'conv_' + c.id,
        group: 'Recent queries',
        label: c.title,
        icon: MessageSquare,
        action: () => {
          router.push(`/chat/${c.id}`);
          onClose();
        },
      })),
    ];
  }, [conversations, router, onClose]);

  // Filter
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q));
  }, [query, commands]);

  // Group by `group`
  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const c of filtered) {
      if (!map.has(c.group)) map.set(c.group, []);
      map.get(c.group)!.push(c);
    }
    return Array.from(map.entries());
  }, [filtered]);

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        filtered[selectedIdx]?.action();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filtered, selectedIdx]);

  return (
    <Modal open={open} onClose={onClose} size="md">
      <div className="-m-7">
        <div className="flex items-center gap-3 border-b border-rule px-5 py-4">
          <Search size={16} className="text-muted" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands, queries, settings…"
            className="flex-1 bg-transparent text-[15px] text-paper outline-none placeholder:text-muted-2"
          />
          <kbd className="rounded border border-rule px-1.5 py-0.5 font-mono text-[10px] text-muted">
            esc
          </kbd>
        </div>

        <div className="max-h-[420px] overflow-auto py-2">
          {filtered.length === 0 && (
            <div className="px-5 py-12 text-center">
              <div className="mb-2 font-serif italic text-muted">no matches.</div>
              <div className="font-mono text-2xs uppercase tracking-[0.12em] text-muted-2">
                try a different keyword
              </div>
            </div>
          )}
          {grouped.map(([group, items]) => (
            <div key={group} className="px-2 py-1">
              <div className="px-3 py-1.5 font-mono text-2xs uppercase tracking-[0.16em] text-muted">
                {group}
              </div>
              {items.map((item) => {
                const idx = filtered.indexOf(item);
                const isActive = idx === selectedIdx;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.action}
                    onMouseEnter={() => setSelectedIdx(idx)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors',
                      isActive ? 'bg-ink-4' : 'hover:bg-ink-3',
                    )}
                  >
                    <span
                      className={cn(
                        'grid h-7 w-7 place-items-center rounded-md',
                        isActive ? 'bg-accent text-ink' : 'bg-ink-4 text-muted',
                      )}
                    >
                      <item.icon size={14} />
                    </span>
                    <span className="flex-1 text-[14px] text-paper">{item.label}</span>
                    {item.hint && (
                      <span className="font-mono text-2xs uppercase tracking-[0.12em] text-muted">
                        {item.hint}
                      </span>
                    )}
                    {isActive && <ArrowRight size={14} className="text-accent" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-rule px-5 py-3 font-mono text-2xs uppercase tracking-[0.12em] text-muted">
          <span className="flex gap-3">
            <span>
              <kbd className="rounded border border-rule px-1 py-px text-[9px]">↑</kbd>{' '}
              <kbd className="rounded border border-rule px-1 py-px text-[9px]">↓</kbd> navigate
            </span>
            <span>
              <kbd className="rounded border border-rule px-1 py-px text-[9px]">↵</kbd> select
            </span>
          </span>
          <span>simbo · ⌘K</span>
        </div>
      </div>
    </Modal>
  );
}
