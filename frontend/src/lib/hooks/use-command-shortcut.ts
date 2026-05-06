'use client';

import { useEffect, useState } from 'react';

/**
 * Listens for ⌘K / Ctrl-K and exposes [open, setOpen] for a command palette.
 * Skips when the user is typing in an input/textarea (so ⌘K still works to go up a token).
 */
export function useCommandShortcut(): [boolean, (v: boolean) => void] {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isModK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      if (!isModK) return;
      e.preventDefault();
      setOpen((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return [open, setOpen];
}
