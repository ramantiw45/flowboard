import axios from 'axios';
import { resolveEndpoints } from '../config/endpoints';

/**
 * The session used to live under these keys. They are kept only so
 * `AuthContext` can delete them once on upgrade - a stale 24h token left in
 * someone's `localStorage` would outlive this change, and that is precisely the
 * exposure being removed. Nothing reads them.
 */
export const LEGACY_TOKEN_KEY = 'taskboard.token';
export const LEGACY_USER_KEY = 'taskboard.user';

/** Removes any credential left behind by the pre-cookie build. */
export function purgeLegacySession(): void {
  try {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(LEGACY_USER_KEY);
  } catch {
    // Private-mode / storage-disabled browsers throw on access. Nothing to do.
  }
}

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

/**
 * The URL the browser actually requests.
 *
 * Relative (`/api`) whenever a same-origin server is in front, which is the
 * Vite dev server and the preview server. Both proxy to the backend.
 *
 * This is what makes the session cookie work. A `SameSite=Lax` cookie is
 * withheld from cross-site XHR, so calling the backend on a different port
 * stores the cookie and then never sends it - measured in Chrome: the cookie was
 * in the store (httpOnly=true, path=/api) and `GET /api/auth/me` still answered
 * 401. `SameSite=None` is not an escape hatch, because it requires `Secure`,
 * which needs real HTTPS. Same-origin requests let `Lax` work as intended and
 * keep CSRF protection meaningful instead of switching it off to compensate.
 *
 * A real deployment sets an absolute `VITE_API_BASE_URL` and serves the app and
 * API from one origin (or over HTTPS), so it is unaffected either way.
 */
const REQUEST_BASE = API_BASE_URL;

export { API_BASE_URL, WS_URL, REQUEST_BASE };

/**
 * Shared axios instance.
 *
 * The session lives in an `HttpOnly` cookie, so there is no token to attach and
 * nothing to read out of `localStorage`. Two things follow from that:
 *
 *  - `withCredentials` makes the browser send the cookie. Without it a
 *    cross-origin call to the API would arrive anonymous.
 *  - the XSRF cookie is echoed back as `X-XSRF-TOKEN`. That cookie is
 *    deliberately NOT `HttpOnly`: reading it is what proves the request
 *    originates from this app rather than another site riding on the browser's
 *    automatic cookie attachment. The session cookie stays `HttpOnly`.
 */
export const api = axios.create({
  baseURL: REQUEST_BASE,
  withCredentials: true,
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
});

/**
 * A bare instance for the auth calls themselves.
 *
 * It must not run the refresh interceptor below: a failed refresh would recurse
 * (refresh -> 401 -> refresh -> ...) and end in a stack overflow rather than a
 * redirect. It is a second instance on purpose, not a flag.
 */
export const authApiRaw = axios.create({
  baseURL: REQUEST_BASE,
  withCredentials: true,
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
});

/** Set by AuthContext so a hard failure can wipe React state, not just cookies. */
let onSessionLost: (() => void) | null = null;

export function setSessionLostHandler(handler: (() => void) | null): void {
  onSessionLost = handler;
}

/**
 * In-flight refresh, shared by every 401 that arrives at once.
 *
 * Without this, a page that fires five requests on mount would send five
 * refreshes. Since refresh tokens are single-use, the first would succeed and
 * the other four would present an already-spent token - which this service
 * treats as a replay and answers by revoking the user's whole session. So a
 * normal cold load could log the user out at random.
 */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = authApiRaw
      .post('/auth/refresh')
      .then(() => true)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

/** The 401s that mean "sign in again" rather than "that was the wrong password". */
function isAuthCall(url: string | undefined): boolean {
  if (!url) return false;
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/signup') ||
    url.includes('/auth/refresh') ||
    url.includes('/auth/logout')
  );
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!axios.isAxiosError(error)) return Promise.reject(error);

    const status = error.response?.status;
    const url = error.config?.url;
    const alreadyRetried = Boolean((error.config as { _retried?: boolean } | undefined)?._retried);

    // 401 on a real API call: the access token expired. Try to renew it
    // silently, then replay the original request exactly once.
    if (status === 401 && !isAuthCall(url) && !alreadyRetried) {
      const renewed = await refreshSession();
      if (renewed) {
        (error.config as { _retried?: boolean })._retried = true;
        return api.request(error.config as never);
      }
      // No usable refresh token: the session is genuinely over.
      onSessionLost?.();
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
