/**
 * Auth API resource.
 *
 * Backend endpoints (all under /api/v1):
 *   POST   /auth/signup               { fullname, email, password }      → { message, user }
 *   POST   /auth/request-otp          { email }                          → { message }
 *   POST   /auth/login                { email, password }                → { user, accessToken, refreshToken }
 *   POST   /auth/verify-otp           { email, otp }                     → { message }
 *   POST   /auth/request-password-reset { email }                        → { message }
 *   PATCH  /auth/reset-password       { email, otp, password, confirmPassword } → { message }
 *   POST   /auth/refresh-token        { refreshToken }  (requires auth)  → { accessToken, refreshToken }
 *
 * Note: no /logout or /me endpoint exists on the backend.
 * Session state is maintained via stored tokens + profile endpoint.
 */

import { http, unwrap } from './http';
import type { AuthTokens, User } from '@/types';

const USER_KEY = 'simbo.user';

// ─── Local user cache ──────────────────────────────────────
// Persists the user object across page reloads without a round-trip.

function storeUser(user: User): void {
  if (globalThis.window !== undefined) {
    globalThis.window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

function loadUser(): User | null {
  if (globalThis.window === undefined) return null;
  try {
    const raw = globalThis.window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function clearUser(): void {
  if (globalThis.window !== undefined) {
    globalThis.window.localStorage.removeItem(USER_KEY);
  }
}

// ─── Response shapes from backend ─────────────────────────

interface BackendUser {
  id: string;
  fullname: string;
  email: string;
  verified: boolean;
  created_at: string;
}

function mapUser(u: BackendUser): User {
  return {
    id: u.id,
    name: u.fullname,
    email: u.email,
    verified: u.verified,
    createdAt: u.created_at,
  };
}

export interface AuthResult {
  tokens: AuthTokens;
  user: User;
}

// ─── API ──────────────────────────────────────────────────

export const authApi = {
  async signup(payload: { name: string; email: string; password: string }): Promise<{ email: string; otpSent: true }> {
    await unwrap<{ message: string; user: BackendUser }>(
      http.post('/auth/signup', { fullname: payload.name, email: payload.email, password: payload.password }),
    );
    return { email: payload.email, otpSent: true };
  },

  async verifyOtp(email: string, otp: string): Promise<{ message: string }> {
    return unwrap<{ message: string }>(http.post('/auth/verify-otp', { email, otp }));
  },

  async requestOtp(email: string): Promise<{ message: string }> {
    return unwrap<{ message: string }>(http.post('/auth/request-otp', { email }));
  },

  async login(email: string, password: string): Promise<AuthResult> {
    const data = await unwrap<{ user: BackendUser; accessToken: string; refreshToken: string }>(
      http.post('/auth/login', { email, password }),
    );
    const user = mapUser(data.user);
    const tokens: AuthTokens = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
    };
    storeUser(user);
    return { tokens, user };
  },

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    return unwrap<{ message: string }>(http.post('/auth/request-password-reset', { email }));
  },

  async resetPassword(email: string, otp: string, password: string): Promise<{ message: string }> {
    return unwrap<{ message: string }>(
      http.patch('/auth/reset-password', { email, otp, password, confirmPassword: password }),
    );
  },

  async refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    return unwrap<{ accessToken: string; refreshToken: string }>(
      http.post('/auth/refresh-token', { refreshToken }),
    );
  },

  /** Restores session from localStorage without a network call. */
  me(): User | null {
    return loadUser();
  },

  logout(): void {
    clearUser();
  },
};
