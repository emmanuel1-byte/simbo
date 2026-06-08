'use client';

import { useEffect, useState } from 'react';
import { connectionsApi } from '@/lib/api';

export type OnboardingState = 'loading' | 'needs_api_key' | 'needs_connection' | 'ready';

/**
 * Determines whether the user has finished setup.
 * API key is now optional — the system provides a built-in AI fallback.
 * Only a connected database is required to use Simbo.
 */
export function useOnboardingState(): OnboardingState {
  const [state, setState] = useState<OnboardingState>('loading');

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const connections = await connectionsApi.list().catch(() => []);
      if (cancelled) return;
      if (!connections.some((c) => c.status === 'connected')) {
        return setState('needs_connection');
      }
      setState('ready');
    }
    void check().catch(() => setState('ready'));
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
