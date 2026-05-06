/**
 * Axios HTTP client used by every API module.
 * - Attaches the bearer token from localStorage on each request.
 * - Normalizes errors into `ApiError`.
 * - Auto-redirects to /signin on 401 (except on auth endpoints).
 *
 * NOTE for backend:
 *   Expected base URL: process.env.NEXT_PUBLIC_API_URL
 *   Expected response shape: { data: T, message?: string }
 *   Expected error shape:    { message: string, code?: string, fieldErrors?: {...} }
 */

import axios, { AxiosError, type AxiosInstance, type AxiosResponse } from 'axios';
import type { ApiError } from '@/types';
import { tokenStorage } from '@/lib/utils/token-storage';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

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

// ─── Response interceptor: unwrap envelope, normalize errors ───
http.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError<ApiError>) => {
    const status = error.response?.status;
    const data = error.response?.data;

    // Auth-protected calls that 401 should kick the user out.
    const isAuthCall = error.config?.url?.includes('/auth/');
    if (status === 401 && !isAuthCall && typeof window !== 'undefined') {
      tokenStorage.clear();
      // Avoid loops: only redirect if we're already inside the app.
      const path = window.location.pathname;
      if (!path.startsWith('/signin') && !path.startsWith('/signup')) {
        window.location.href = `/signin?next=${encodeURIComponent(path)}`;
      }
    }

    const apiError: ApiError = {
      message:
        data?.message ??
        (status ? `Request failed (${status}). Try again.` : 'Network error. Check your connection.'),
      code: data?.code,
      fieldErrors: data?.fieldErrors,
      status,
    };
    return Promise.reject(apiError);
  },
);

/**
 * Helper to extract the inner data from a typical API envelope.
 * Use it in resource modules to keep call sites tidy.
 */
export async function unwrap<T>(promise: Promise<AxiosResponse<{ data: T }>>): Promise<T> {
  const res = await promise;
  return res.data.data;
}
