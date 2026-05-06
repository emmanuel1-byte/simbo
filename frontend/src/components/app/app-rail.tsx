'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import {
  MessageSquare,
  Clock,
  Bookmark,
  Database,
  Settings as SettingsIcon,
  Logout,
} from '@/components/icons';
import { useAuth } from '@/contexts/auth-context';

const items = [
  { href: '/ask', icon: MessageSquare, label: 'Ask' },
  { href: '/history', icon: Clock, label: 'History' },
  { href: '/settings/connections', icon: Database, label: 'Connections', match: '/settings/connections' },
  { href: '/settings/security', icon: SettingsIcon, label: 'Settings', match: '/settings' },
] as const;

export function AppRail() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  return (
    <aside className="flex w-[60px] flex-shrink-0 flex-col items-center border-r border-rule bg-ink-2 py-5">
      {/* Logo */}
      <Link
        href="/ask"
        className="mb-4 grid h-[30px] w-[30px] place-items-center rounded-md bg-accent font-mono text-[15px] font-bold text-ink"
        style={{ boxShadow: '0 0 24px rgba(211,255,58,0.4)' }}
      >
        S
      </Link>

      {/* Nav */}
      <nav className="flex flex-col items-center gap-1">
        {items.slice(0, 2).map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-label={label}
              className={cn(
                'grid h-9 w-9 place-items-center rounded-lg transition-colors',
                active ? 'bg-ink-4 text-accent' : 'text-muted hover:bg-ink-4 hover:text-paper',
              )}
            >
              <Icon size={18} />
            </Link>
          );
        })}

        <span className="my-2 h-px w-6 bg-rule" />

        {items.slice(2).map(({ href, icon: Icon, label, match }) => {
          const active = pathname.startsWith(match ?? href);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-label={label}
              className={cn(
                'grid h-9 w-9 place-items-center rounded-lg transition-colors',
                active ? 'bg-ink-4 text-accent' : 'text-muted hover:bg-ink-4 hover:text-paper',
              )}
            >
              <Icon size={18} />
            </Link>
          );
        })}
      </nav>

      {/* Bottom — avatar + logout */}
      <div className="mt-auto flex flex-col items-center gap-3">
        <button
          type="button"
          title="Sign out"
          aria-label="Sign out"
          onClick={async () => {
            setLoggingOut(true);
            await logout();
            router.replace('/signin');
          }}
          disabled={loggingOut}
          className="grid h-9 w-9 place-items-center rounded-lg text-muted transition-colors hover:bg-ink-4 hover:text-warn disabled:opacity-60"
        >
          <Logout size={18} />
        </button>
        <Link
          href="/settings/profile"
          className="block h-8 w-8 rounded-full border border-rule-2 bg-gradient-to-br from-[#c4a07a] to-[#7a5b3a] grid place-items-center text-[10px] font-mono font-medium text-paper"
          title={user?.name ?? 'Profile'}
        >
          {user?.name?.[0]?.toUpperCase() ?? 'A'}
        </Link>
      </div>
    </aside>
  );
}
