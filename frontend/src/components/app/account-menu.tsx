'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { ChevronDown, Key, Logout, Settings as SettingsIcon, Shield, User as UserIcon } from '@/components/icons';
import { cn } from '@/lib/utils/cn';

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
        className="flex items-center gap-2 rounded-sm border border-rule-2 bg-ink-3 px-2 py-1 transition-all hover:border-rule-3 hover:bg-ink-4"
      >
        <div className="grid h-5 w-5 place-items-center rounded-full bg-accent/15 font-mono text-[9px] font-medium text-accent">
          {user.name?.[0]?.toUpperCase() ?? 'A'}
        </div>
        <span className="hidden font-mono text-[11px] text-paper-2 sm:inline">{user.name}</span>
        <ChevronDown size={11} className="text-paper-3" />
      </button>

      {open && (
        <div
          className={cn(
            'absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-md border border-rule-2 bg-ink-3 shadow-overlay animate-scale-in',
          )}
        >
          {/* User info */}
          <div className="border-b border-rule px-4 py-3.5">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-accent/15 font-mono text-[13px] font-medium text-accent">
                {user.name?.[0]?.toUpperCase() ?? 'A'}
              </div>
              <div className="min-w-0">
                <b className="block truncate text-[13px] font-medium text-paper">{user.name}</b>
                <span className="block truncate font-mono text-[10px] text-paper-2">{user.email}</span>
              </div>
            </div>
          </div>

          {/* Links */}
          <div className="p-1.5">
            {[
              { href: '/settings/profile',  label: 'Profile',      icon: UserIcon },
              { href: '/settings/api-key',  label: 'API key',      icon: Key },
              { href: '/settings/security', label: 'Security',     icon: Shield },
              { href: '/settings',          label: 'All settings', icon: SettingsIcon },
            ].map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-sm px-3 py-2 text-[13px] text-paper-2 transition-colors hover:bg-ink-4 hover:text-paper"
              >
                <Icon size={13} className="text-paper-3" />
                {label}
              </Link>
            ))}
          </div>

          {/* Logout */}
          <div className="border-t border-rule p-1.5">
            <button
              type="button"
              disabled={loggingOut}
              onClick={() => {
                setLoggingOut(true);
                logout();
                router.replace('/signin');
              }}
              className="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-[13px] text-warn transition-colors hover:bg-warn/8 disabled:opacity-50"
            >
              <Logout size={13} />
              {loggingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
