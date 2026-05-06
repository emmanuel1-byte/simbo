/**
 * Auth API resource.
 *
 * BACKEND CONTRACT (Golang) — endpoints expected:
 *   POST   /auth/signup            { name, email, password } → { user, otpSent: true }
 *   POST   /auth/verify-otp        { email, code }            → { tokens, user }
 *   POST   /auth/resend-otp        { email }                  → { sent: true, cooldownSec }
 *   POST   /auth/login             { email, password }        → { tokens, user }
 *   POST   /auth/forgot-password   { email }                  → { sent: true, cooldownSec }
 *   POST   /auth/reset-password    { email, code, password }  → { ok: true }
 *   POST   /auth/refresh           { refreshToken }           → { tokens }
 *   GET    /auth/me                                           → { user }
 *   POST   /auth/logout                                       → { ok: true }
 *
 * Switch behaviour with NEXT_PUBLIC_USE_MOCKS=true to develop against mocks.
 */

import { http, unwrap } from './http';
import type { AuthTokens, User } from '@/types';
import { mockUser } from '@/lib/data/mocks';

const useMocks = process.env.NEXT_PUBLIC_USE_MOCKS === 'true';

// Helper: simulate network latency for mocks
const delay = (ms = 600) => new Promise((res) => setTimeout(res, ms));

function fakeTokens(): AuthTokens {
  return {
    accessToken: 'mock_access_' + Math.random().toString(36).slice(2),
    refreshToken: 'mock_refresh_' + Math.random().toString(36).slice(2),
    expiresAt: Math.floor(Date.now() / 1000) + 60 * 60,
  };
}

export interface SignupPayload {
  name: string;
  email: string;
  password: string;
}

export interface AuthResult {
  tokens: AuthTokens;
  user: User;
}

export const authApi = {
  async signup(payload: SignupPayload): Promise<{ email: string; otpSent: true }> {
    if (useMocks) {
      await delay();
      return { email: payload.email, otpSent: true };
    }
    return unwrap<{ email: string; otpSent: true }>(http.post('/auth/signup', payload));
  },

  async verifyOtp(email: string, code: string): Promise<AuthResult> {
    if (useMocks) {
      await delay();
      if (code !== '123456') {
        throw { message: 'That code looks wrong. Try again or request a new one.', code: 'INVALID_OTP' };
      }
      return { tokens: fakeTokens(), user: { ...mockUser, email, emailVerified: true } };
    }
    return unwrap<AuthResult>(http.post('/auth/verify-otp', { email, code }));
  },

  async resendOtp(email: string): Promise<{ sent: true; cooldownSec: number }> {
    if (useMocks) {
      await delay(400);
      return { sent: true, cooldownSec: 60 };
    }
    return unwrap<{ sent: true; cooldownSec: number }>(http.post('/auth/resend-otp', { email }));
  },

  async login(email: string, password: string): Promise<AuthResult> {
    if (useMocks) {
      await delay();
      if (password.length < 6) {
        throw { message: 'Email or password is incorrect.', code: 'INVALID_CREDENTIALS' };
      }
      return { tokens: fakeTokens(), user: { ...mockUser, email } };
    }
    return unwrap<AuthResult>(http.post('/auth/login', { email, password }));
  },

  async forgotPassword(email: string): Promise<{ sent: true; cooldownSec: number }> {
    if (useMocks) {
      await delay();
      return { sent: true, cooldownSec: 60 };
    }
    return unwrap<{ sent: true; cooldownSec: number }>(http.post('/auth/forgot-password', { email }));
  },

  async resetPassword(email: string, code: string, password: string): Promise<{ ok: true }> {
    if (useMocks) {
      await delay();
      if (code !== '123456') {
        throw { message: 'Reset code is invalid or expired.', code: 'INVALID_OTP' };
      }
      return { ok: true };
    }
    return unwrap<{ ok: true }>(http.post('/auth/reset-password', { email, code, password }));
  },

  async me(): Promise<User> {
    if (useMocks) {
      await delay(200);
      return mockUser;
    }
    return unwrap<User>(http.get('/auth/me'));
  },

  async logout(): Promise<{ ok: true }> {
    if (useMocks) {
      await delay(200);
      return { ok: true };
    }
    return unwrap<{ ok: true }>(http.post('/auth/logout'));
  },
};
