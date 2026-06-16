'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils/cn';

interface OAuthButtonProps {
  provider: 'google';
  label: string;
  className?: string;
}

/**
 * OAuth trigger.
 * BACKEND: redirects to `${API}/auth/google` which should bounce back with tokens.
 * For now, since we're frontend-only, we display a friendly placeholder toast.
 */
export function OAuthButton({ provider, label, className }: OAuthButtonProps) {
  const [busy, setBusy] = useState(false);

  function handleClick() {
    setBusy(true);
    // TODO(BE): replace this with `window.location.href = `${API}/auth/${provider}`
    setTimeout(() => {
      toast.info('OAuth flow coming online. Wire to /auth/google when ready.', {
        description: 'For now, use email + password to sign in.',
      });
      setBusy(false);
    }, 300);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={cn(
        'flex w-full items-center justify-center gap-3 rounded-lg border border-rule bg-transparent px-4 py-3 text-sm text-paper transition-colors hover:border-paper disabled:opacity-60',
        className,
      )}
    >
      {provider === 'google' && (
        <span
          className="h-[18px] w-[18px] rounded-full"
          style={{
            background:
              'conic-gradient(from 90deg, #4285f4, #34a853, #fbbc05, #ea4335, #4285f4)',
          }}
        />
      )}
      Continue with {label}
    </button>
  );
}
