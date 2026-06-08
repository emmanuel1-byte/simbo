'use client';

/**
 * Auth context.
 *
 * Session lifecycle:
 *   - On mount: restore user from localStorage (written on login) and confirm
 *     the token is still present. No network call needed unless you want to
 *     validate server-side — the HTTP client will 401 naturally on expiry.
 *   - login/completeAuth: persist tokens + user, set state.
 *   - logout: clear storage, reset state.
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
  logout: () => void;
  refresh: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>('idle');

  const refresh = useCallback(() => {
    const tokens = tokenStorage.get();
    if (!tokens) {
      setStatus('unauthenticated');
      setUser(null);
      return;
    }
    const stored = authApi.me();
    if (stored) {
      setUser(stored);
      setStatus('authenticated');
    } else {
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

  const logout = useCallback(() => {
    authApi.logout();
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
