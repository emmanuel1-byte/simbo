'use client';

/**
 * Auth context.
 *
 * Responsibilities:
 *   - On mount: try to resolve the current user using the stored access token.
 *   - Expose helpers to login/signup/logout that mutate state and storage together.
 *   - Provide a `status` ('idle' | 'loading' | 'authenticated' | 'unauthenticated')
 *     so consumers can render skeletons/redirects without flicker.
 *
 * Usage:
 *   const { user, status, login, logout } = useAuth();
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi } from '@/lib/api';
import type { AuthTokens, User } from '@/types';
import { tokenStorage } from '@/lib/utils/token-storage';

type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<User>;
  completeAuth: (tokens: AuthTokens, user: User) => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>('idle');

  const refresh = useCallback(async () => {
    const tokens = tokenStorage.get();
    if (!tokens) {
      setStatus('unauthenticated');
      setUser(null);
      return;
    }
    setStatus('loading');
    try {
      const me = await authApi.me();
      setUser(me);
      setStatus('authenticated');
    } catch {
      tokenStorage.clear();
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const completeAuth = useCallback((tokens: AuthTokens, nextUser: User) => {
    tokenStorage.set(tokens);
    setUser(nextUser);
    setStatus('authenticated');
  }, []);

  const login = useCallback<AuthContextValue['login']>(
    async (email, password) => {
      const { tokens, user: loggedIn } = await authApi.login(email, password);
      completeAuth(tokens, loggedIn);
      return loggedIn;
    },
    [completeAuth],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* swallow — we still clear locally */
    }
    tokenStorage.clear();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, logout, completeAuth, refresh }),
    [user, status, login, logout, completeAuth, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>.');
  return ctx;
}
