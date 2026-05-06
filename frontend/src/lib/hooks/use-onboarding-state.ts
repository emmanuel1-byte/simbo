'use client';

import { useEffect, useState } from 'react';
import { apiKeyApi, connectionsApi } from '@/lib/api';

export type OnboardingState = 'loading' | 'needs_api_key' | 'needs_connection' | 'ready';

/**
 * Determines whether the user has finished setup:
 * 1. An AI provider key is configured.
 * 2. At least one connected database exists.
 *
 * The Ask page uses this to nudge new users into setup before they get
 * an empty input that doesn't actually work.
 */
export function useOnboardingState(): OnboardingState {
  const [state, setState] = useState<OnboardingState>('loading');

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const [key, connections] = await Promise.all([
        apiKeyApi.get().catch(() => null),
        connectionsApi.list().catch(() => []),
      ]);
      if (cancelled) return;
      if (!key) return setState('needs_api_key');
      if (!connections.some((c) => c.status === 'connected')) {
        return setState('needs_connection');
      }
      setState('ready');
    }
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
