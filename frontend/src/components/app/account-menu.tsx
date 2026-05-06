'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import {
  ChevronDown,
  Key,
  Logout,
  Settings as SettingsIcon,
  Shield,
  User as UserIcon,
} from '@/components/icons';
import { cn } from '@/lib/utils/cn';

/**
 * Avatar pill in the topbar that opens a small menu with profile + logout.
 * Closes on outside click and Escape.
 */
export function AccountMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md border border-rule bg-ink px-2 py-1 transition-colors hover:border-rule-2"
      >
        <div className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-[#c4a07a] to-[#7a5b3a] font-mono text-[10px] font-medium text-paper">
          {user.name?.[0]?.toUpperCase() ?? 'A'}
        </div>
        <span className="hidden font-mono text-[11px] text-paper sm:inline">{user.name}</span>
        <ChevronDown size={12} className="text-muted" />
      </button>

      {open && (
        <div
          className={cn(
            'absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-rule bg-ink-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-fade-in-up',
          )}
        >
          <div className="border-b border-rule p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-[#c4a07a] to-[#7a5b3a] font-mono text-[14px] font-medium text-paper">
                {user.name?.[0]?.toUpperCase() ?? 'A'}
              </div>
              <div className="min-w-0">
                <b className="block truncate text-[13px] font-medium">{user.name}</b>
                <span className="block truncate font-mono text-[10px] text-muted">{user.email}</span>
              </div>
            </div>
          </div>
          <div className="p-1.5">
            {[
              { href: '/settings/profile', label: 'Profile', icon: UserIcon },
              { href: '/settings/api-key', label: 'API key', icon: Key },
              { href: '/settings/security', label: 'Security', icon: Shield },
              { href: '/settings', label: 'All settings', icon: SettingsIcon },
            ].map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-[13px] text-paper transition-colors hover:bg-ink-3"
              >
                <Icon size={14} />
                {label}
              </Link>
            ))}
          </div>
          <div className="border-t border-rule p-1.5">
            <button
              type="button"
              disabled={loggingOut}
              onClick={async () => {
                setLoggingOut(true);
                await logout();
                router.replace('/signin');
              }}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-[13px] text-warn transition-colors hover:bg-warn/10"
            >
              <Logout size={14} />
              {loggingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
