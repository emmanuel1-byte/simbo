'use client';

import { useState } from 'react';
import { AppRail } from '@/components/app/app-rail';
import { CommandPalette } from '@/components/app/command-palette';
import { useCommandShortcut } from '@/lib/hooks/use-command-shortcut';
import { InspectorProvider } from '@/contexts/inspector-context';
import { MessageSquare, Menu } from '@/components/icons';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [paletteOpen, setPaletteOpen] = useCommandShortcut();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <InspectorProvider>
      <div className="flex min-h-screen bg-ink">

        {/* Desktop sidebar */}
        <div className="sticky top-0 hidden h-screen lg:block">
          <AppRail />
        </div>

        {/* Mobile top bar */}
        <header className="fixed inset-x-0 top-0 z-40 flex h-12 items-center justify-between border-b border-rule bg-ink-2/90 px-4 backdrop-blur-sm lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="font-serif text-[16px] italic text-accent"
          >
            simbo
          </button>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="Open command palette"
            className="grid h-8 w-8 place-items-center rounded-sm text-paper-2 transition-colors hover:bg-ink-4 hover:text-paper"
          >
            <Menu size={16} />
          </button>
        </header>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-ink/70 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <div className="absolute left-0 top-0 h-full animate-slide-right shadow-overlay">
              <AppRail />
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="flex min-w-0 flex-1 flex-col pt-12 lg:pt-0">
          {children}
        </div>

        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

        {/* Mobile FAB */}
        <button
          type="button"
          onClick={() => { window.location.href = `/chat/new_${Date.now()}`; }}
          className="fixed bottom-6 right-6 z-30 grid h-12 w-12 place-items-center rounded-lg bg-accent text-paper-inv shadow-floating lg:hidden"
          aria-label="New chat"
        >
          <MessageSquare size={18} />
        </button>

      </div>
    </InspectorProvider>
  );
}
