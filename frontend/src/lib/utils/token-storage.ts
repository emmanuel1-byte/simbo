/**
 * SSR-safe localStorage wrappers. Auth tokens live here for now;
 * when the BE switches to httpOnly cookies, we'll swap the implementation
 * without changing call sites.
 */

import type { AuthTokens } from '@/types';

const ACCESS_KEY = 'simbo.access_token';
const REFRESH_KEY = 'simbo.refresh_token';
const EXPIRES_KEY = 'simbo.token_expires_at';

const isBrowser = typeof window !== 'undefined';

export const tokenStorage = {
  get(): AuthTokens | null {
    if (!isBrowser) return null;
    const accessToken = window.localStorage.getItem(ACCESS_KEY);
    const refreshToken = window.localStorage.getItem(REFRESH_KEY);
    const expiresAt = Number(window.localStorage.getItem(EXPIRES_KEY) ?? 0);
    if (!accessToken || !refreshToken) return null;
    return { accessToken, refreshToken, expiresAt };
  },

  set(tokens: AuthTokens): void {
    if (!isBrowser) return;
    window.localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    window.localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
    window.localStorage.setItem(EXPIRES_KEY, String(tokens.expiresAt));
  },

  clear(): void {
    if (!isBrowser) return;
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
    window.localStorage.removeItem(EXPIRES_KEY);
  },

  accessToken(): string | null {
    if (!isBrowser) return null;
    return window.localStorage.getItem(ACCESS_KEY);
  },
};
