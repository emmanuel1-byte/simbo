/**
 * Axios HTTP client used by every API module.
 * - Attaches the bearer token from localStorage on each request.
 * - Normalizes errors into `ApiError`.
 * - Auto-redirects to /signin on 401 (except on auth endpoints).
 *
 * Backend base URL:  NEXT_PUBLIC_API_URL  (default: http://localhost:9090/api/v1)
 * Response envelope: { success: boolean, data?: T, error?: { code: string, message: string } }
 * Error envelope:    { success: false, error: { code: string, message: string } }
 */

import axios, { AxiosError, type AxiosInstance, type AxiosResponse } from 'axios';
import type { ApiError } from '@/types';
import { tokenStorage } from '@/lib/utils/token-storage';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:9090/api/v1';

export const http: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request interceptor: attach bearer token ─────────────
http.interceptors.request.use((config) => {
  const token = tokenStorage.accessToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response interceptor: normalize errors ───────────────
http.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError<{ success: false; error?: { code?: string; message?: string } }>) => {
    const status = error.response?.status;
    const body = error.response?.data;

    // Kick unauthenticated users back to signin (skip for auth routes themselves).
    const isAuthRoute = error.config?.url?.includes('/auth/');
    if (status === 401 && !isAuthRoute && globalThis.window !== undefined) {
      tokenStorage.clear();
      const path = globalThis.window.location.pathname;
      if (!path.startsWith('/signin') && !path.startsWith('/signup')) {
        globalThis.window.location.href = `/signin?next=${encodeURIComponent(path)}`;
      }
    }

    const apiError: ApiError = {
      message:
        body?.error?.message ??
        (status ? `Request failed (${status}). Try again.` : 'Network error. Check your connection.'),
      code: body?.error?.code,
      status,
    };
    return Promise.reject(Object.assign(new Error(apiError.message), apiError));
  },
);

/**
 * Unwraps the `{ success, data }` envelope returned by every backend endpoint.
 */
export async function unwrap<T>(promise: Promise<AxiosResponse<{ success: boolean; data: T }>>): Promise<T> {
  const res = await promise;
  return res.data.data;
}
