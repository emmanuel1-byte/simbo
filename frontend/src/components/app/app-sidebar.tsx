'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { useAuth } from '@/contexts/auth-context';
import { useInspector } from '@/contexts/inspector-context';
import { Inspector } from '@/components/chat/inspector';
import { MessageSquare } from '@/components/icons';

const NAV_ITEMS = [
  { href: '/history',              label: 'History',     match: '/history' },
  { href: '/settings/connections', label: 'Connections', match: '/settings/connections' },
  { href: '/settings',             label: 'Settings',    match: '/settings' },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, logout } = useAuth();
  const { message, liveSteps } = useInspector();
  const [loggingOut, setLoggingOut] = useState(false);

  function isActive(href: string, match?: string) {
    return pathname.startsWith(match ?? href);
  }

  function newChat() {
    router.push(`/chat/new_${Date.now()}`);
  }

  return (
    <aside className="flex h-screen w-[360px] flex-shrink-0 flex-col border-r border-rule bg-ink-2">

      {/* Brand */}
      <div className="flex-none px-5 pb-4 pt-6">
        <button
          type="button"
          onClick={newChat}
          className="font-serif text-[17px] italic text-accent transition-opacity hover:opacity-80"
        >
          simbo
        </button>
      </div>

      {/* Primary nav */}
      <div className="flex-none px-3">
        <button
          type="button"
          onClick={newChat}
          className="mb-1 flex w-full items-center gap-2 rounded-sm px-2.5 py-2 font-mono text-[12px] tracking-wide text-paper-3 transition-colors hover:bg-ink-4/50 hover:text-paper-2"
        >
          <MessageSquare size={12} />
          New chat
        </button>

        <div className="my-3 h-px bg-rule" />

        <div className="flex flex-col gap-0.5">
          {NAV_ITEMS.map(({ href, label, match }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'relative flex items-center gap-2 rounded-sm px-2.5 py-2 font-mono text-[12px] tracking-wide transition-colors duration-100',
                isActive(href, match)
                  ? 'bg-ink-4 text-paper'
                  : 'text-paper-3 hover:bg-ink-4/50 hover:text-paper-2',
              )}
            >
              {isActive(href, match) && (
                <span className="absolute left-0 top-1/2 h-4 w-[2.5px] -translate-y-1/2 rounded-full bg-accent" />
              )}
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* ── Evidence panel — fills remaining height ─────────────────────── */}
      <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden border-t border-rule">
        <Inspector message={message} liveSteps={liveSteps} />
      </div>

      {/* Footer */}
      <div className="flex-none border-t border-rule px-3 py-4">
        <Link
          href="/settings/profile"
          title={user?.name ?? 'Profile'}
          className="mb-2 flex items-center gap-2.5 rounded-sm px-2 py-1.5 transition-colors hover:bg-ink-4"
        >
          <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-accent/15 font-mono text-[10px] font-medium text-accent">
            {user?.name?.[0]?.toUpperCase() ?? 'A'}
          </span>
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-paper-2">
            {user?.name ?? 'Account'}
          </span>
        </Link>
        <button
          type="button"
          disabled={loggingOut}
          onClick={() => {
            setLoggingOut(true);
            logout();
            router.replace('/signin');
          }}
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 font-mono text-[11px] text-paper-3 transition-colors hover:bg-ink-4 hover:text-warn disabled:opacity-40"
        >
          Sign out
        </button>
      </div>

    </aside>
  );
}
