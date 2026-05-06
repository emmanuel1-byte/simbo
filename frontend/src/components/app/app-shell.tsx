'use client';

import { useState } from 'react';
import { AppRail } from '@/components/app/app-rail';
import { CommandPalette } from '@/components/app/command-palette';
import { useCommandShortcut } from '@/lib/hooks/use-command-shortcut';
import { cn } from '@/lib/utils/cn';
import { MessageSquare } from '@/components/icons';
import { BrandMark } from '@/components/ui/brand';

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * Client shell: rail + topbar slot + command palette + mobile drawer.
 * Page-specific topbars render inside `children`.
 */
export function AppShell({ children }: AppShellProps) {
  const [paletteOpen, setPaletteOpen] = useCommandShortcut();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-rule bg-ink-2/95 px-4 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="grid h-9 w-9 place-items-center rounded-md border border-rule text-paper"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <BrandMark size={18} />
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          aria-label="Search"
          className="grid h-9 w-9 place-items-center rounded-md border border-rule text-paper"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </button>
      </header>

      {/* Rail — desktop fixed, mobile slide-in */}
      <div className="hidden lg:block">
        <AppRail />
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/80 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div
            className={cn(
              'absolute left-0 top-0 h-full w-[60px] animate-fade-in',
            )}
          >
            <AppRail />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col pt-14 lg:pt-0">{children}</div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      {/* Floating "ask" button on mobile */}
      <a
        href="/ask"
        className="fixed bottom-6 right-6 z-30 grid h-12 w-12 place-items-center rounded-full bg-accent text-ink shadow-[0_8px_24px_rgba(211,255,58,0.4)] lg:hidden"
        aria-label="Ask"
      >
        <MessageSquare size={18} />
      </a>
    </div>
  );
}
