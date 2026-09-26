import axios, { AxiosError } from 'axios';
import { resolveEndpoints } from '../config/endpoints';

export const TOKEN_KEY = 'taskboard.token';
export const USER_KEY = 'taskboard.user';

/**
 * Endpoints come from the build-time environment, defaulting to the values that
 * were previously hardcoded, so local development is unchanged.
 */
const { apiBaseUrl: API_BASE_URL, wsUrl: WS_URL } = resolveEndpoints(
  {
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
    VITE_WS_URL: import.meta.env.VITE_WS_URL,
  },
  // Only matters for a relative VITE_API_BASE_URL (same-origin reverse proxy).
  typeof window === 'undefined' ? undefined : window.location.origin
);

export { API_BASE_URL, WS_URL };

/** Shared axios instance — JWT request interceptor + 401 auto-logout. */
export const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthCall =
      error instanceof AxiosError &&
      ((error.config?.url ?? '').includes('/auth/login') ||
        (error.config?.url ?? '').includes('/auth/signup'));

    // Expired/invalid token: wipe session and force re-authentication.
    // A failed sign-in attempt is a normal 401 and must NOT nuke the session.
    if (axios.isAxiosError(error) && error.response?.status === 401 && !isAuthCall) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login?expired=1';
      }
    }
    return Promise.reject(error);
  }
);

/** Extracts a human-readable message from a backend ProblemDetail error. */
export function apiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      | { detail?: string; errors?: Record<string, string>; message?: string }
      | undefined;
    if (data?.errors) return Object.values(data.errors).join(', ');
    if (data?.detail) return data.detail;
    if (data?.message) return data.message;
    if (err.response) return `Request failed with status ${err.response.status}. Please try again.`;
    return 'Cannot reach the server. Check your connection and try again.';
  }
  return 'An unexpected error occurred';
}
