'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { useAuth } from '@/contexts/auth-context';
import {
  MessageSquare,
  Clock,
  Database,
  Settings,
  User as UserIcon,
  Key,
  Shield,
} from '@/components/icons';

const NAV_MAIN = [
  { href: '/history',              label: 'History',     icon: Clock,     match: '/history' },
  { href: '/settings/connections', label: 'Connections', icon: Database,  match: '/settings/connections' },
  { href: '/settings',             label: 'Settings',    icon: Settings,  match: '/settings' },
];

const SETTINGS_GROUPS = [
  {
    label: 'Workspace',
    items: [{ href: '/settings/profile', icon: UserIcon, label: 'Profile' }],
  },
  {
    label: 'Data',
    items: [
      { href: '/settings/connections', icon: Database, label: 'Connections' },
      { href: '/settings/api-key',     icon: Key,      label: 'API key' },
    ],
  },
  {
    label: 'Trust',
    items: [{ href: '/settings/security', icon: Shield, label: 'Security' }],
  },
];

export function AppRail() {
  const pathname  = usePathname();
  const router    = useRouter();
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const inSettings = pathname.startsWith('/settings');

  function isActive(href: string, match?: string) {
    if (match) return pathname.startsWith(match);
    return pathname === href;
  }

  function newChat() {
    router.push(`/chat/new_${Date.now()}`);
  }

  return (
    <aside className="flex h-screen w-44 flex-shrink-0 flex-col border-r border-rule bg-ink-2">

      {/* Brand */}
      <div className="px-5 pb-5 pt-6">
        <button
          type="button"
          onClick={newChat}
          className="font-serif text-[17px] italic text-accent transition-opacity hover:opacity-80"
        >
          simbo
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-3">

        {/* New chat */}
        <button
          type="button"
          onClick={newChat}
          className={cn(
            'mb-1 flex items-center gap-2 rounded-sm px-2.5 py-2 font-mono text-[12px] tracking-wide transition-colors duration-100',
            pathname.startsWith('/chat')
              ? 'bg-ink-4 text-paper'
              : 'text-paper-3 hover:bg-ink-4/50 hover:text-paper-2',
          )}
        >
          <MessageSquare size={12} />
          New chat
        </button>

        <div className="my-1.5 h-px bg-rule" />

        {inSettings ? (
          /* ── Settings contextual nav ───────────────────────────────── */
          <div className="flex flex-col gap-4 pt-1">
            {SETTINGS_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="mb-1 px-2.5 font-mono text-[9px] uppercase tracking-[0.14em] text-paper-3/60">
                  {group.label}
                </p>
                {group.items.map(({ href, icon: Icon, label }) => {
                  const active = pathname === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        'relative flex items-center gap-2 rounded-sm px-2.5 py-2 font-mono text-[12px] tracking-wide transition-colors duration-100',
                        active
                          ? 'bg-ink-4 text-paper'
                          : 'text-paper-3 hover:bg-ink-4/50 hover:text-paper-2',
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 h-4 w-[2.5px] -translate-y-1/2 rounded-full bg-accent" />
                      )}
                      <Icon size={12} />
                      {label}
                    </Link>
                  );
                })}
              </div>
            ))}

            {/* Back to main nav */}
            <div className="mt-auto h-px bg-rule" />
            {NAV_MAIN.filter((n) => !n.match.startsWith('/settings')).map(({ href, label, icon: Icon, match }) => (
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
                <Icon size={12} />
                {label}
              </Link>
            ))}
          </div>
        ) : (
          /* ── Default nav ───────────────────────────────────────────── */
          <div className="flex flex-col gap-0.5">
            {NAV_MAIN.map(({ href, label, icon: Icon, match }) => (
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
                <Icon size={12} />
                {label}
              </Link>
            ))}
          </div>
        )}

      </nav>

      {/* Footer — user + logout */}
      <div className="border-t border-rule px-3 py-4">
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
