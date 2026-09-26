/**
 * Where the API and the WebSocket live, and the CSP that has to permit them.
 *
 * This module is the single source of truth for BOTH the URLs the app calls
 * (`src/api/client.ts`) and the `connect-src` of the Content-Security-Policy
 * (`vite.config.ts`). Those two used to be written out twice, and a stale
 * `connect-src` does not throw an error - it silently blocks every fetch and
 * socket, so the copies could drift with nothing failing until a user could not
 * load a board at all. `tools/cspcheck.mjs` is the regression test for that.
 *
 * Configuration is build-time, via Vite's env handling:
 *   VITE_API_BASE_URL   default http://localhost:8080/api
 *   VITE_WS_URL         default derived from VITE_API_BASE_URL
 * See `.env.example`. The defaults reproduce the previously hardcoded values, so
 * local development is unchanged.
 */

/** Where the backend lives when nothing is configured. */
export const DEFAULT_API_BASE_URL = 'http://localhost:8080/api';

/** SockJS/STOMP endpoint path on the backend. */
const WS_PATH = '/ws-board';

/** The subset of `import.meta.env` / `loadEnv()` that these values come from. */
export interface EndpointEnv {
  VITE_API_BASE_URL?: string;
  VITE_WS_URL?: string;
}

/** Used by `vite.config.ts` (Node) and as a browser fallback. */
const FALLBACK_ORIGIN = 'http://localhost:8080';

/**
 * Trailing slashes would make axios join `baseURL` + `/auth/login` as
 * `//auth/login`, which the backend does not route.
 */
function trimTrailingSlashes(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

/**
 * SockJS endpoint derived from the API base URL.
 *
 * Deriving rather than repeating the host means setting only
 * `VITE_API_BASE_URL=https://api.example.com` also moves the socket, which is
 * what an operator expects. The scheme is deliberately preserved: SockJS is
 * conventionally configured with an `http(s)://` URL and picks the matching
 * `ws(s)://` transport itself, so rewriting it here would be a behavioural
 * change for no gain. A TLS deployment still ends up on `wss`, because that is
 * what SockJS derives from `https`.
 */
function deriveWsUrl(apiBaseUrl: string, currentOrigin: string): string {
  try {
    const url = new URL(apiBaseUrl, currentOrigin);
    return `${url.protocol}//${url.host}${WS_PATH}`;
  } catch {
    return DEFAULT_API_BASE_URL.replace(/\/api$/, '') + WS_PATH;
  }
}

/**
 * Resolves the endpoints from the environment.
 *
 * `currentOrigin` lets a relative `VITE_API_BASE_URL` (e.g. `/api`, for a
 * same-origin reverse proxy) resolve against wherever the app is served from.
 */
export function resolveEndpoints(
  env: EndpointEnv,
  currentOrigin: string = FALLBACK_ORIGIN
): { apiBaseUrl: string; wsUrl: string } {
  const apiBaseUrl = trimTrailingSlashes(env.VITE_API_BASE_URL ?? '') || DEFAULT_API_BASE_URL;
  const wsUrl =
    trimTrailingSlashes(env.VITE_WS_URL ?? '') || deriveWsUrl(apiBaseUrl, currentOrigin);
  return { apiBaseUrl, wsUrl };
}

/**
 * The `connect-src` source list. Every origin contributes both its http and its
 * ws form, because the same host is reached over both.
 */
export function connectSources(
  apiBaseUrl: string,
  wsUrl: string,
  currentOrigin: string = FALLBACK_ORIGIN
): string {
  const sources = new Set<string>();
  for (const value of [apiBaseUrl, wsUrl]) {
    try {
      const origin = new URL(value, currentOrigin).origin;
      sources.add(origin);
      sources.add(origin.replace(/^http/, 'ws'));
    } catch {
      // An unparseable value will fail loudly on its own; it must not take the
      // whole policy down with it.
    }
  }
  return [...sources].join(' ');
}

/**
 * The app's Content-Security-Policy, derived from what the app actually loads:
 *  - `script-src` omits 'unsafe-inline' and 'unsafe-eval'. There is no inline
 *    <script> and no eval()/new Function() anywhere in src, so neither is
 *    needed.
 *  - `style-src` keeps 'unsafe-inline' because React sets inline style
 *    attributes, and Google Fonts is loaded as a stylesheet.
 *  - `connect-src` is computed from the resolved endpoints via `connectSources`.
 *
 * The backend is a pure JSON API and serves no HTML, so a CSP set there would
 * never be evaluated by a browser. The policy that actually protects the app
 * travels with the document: sent as a header by the dev/preview server AND
 * injected into the production build.
 */
export function buildCsp(
  apiBaseUrl: string,
  wsUrl: string,
  options: { meta?: boolean; currentOrigin?: string } = {}
): string {
  const connectSrc = connectSources(apiBaseUrl, wsUrl, options.currentOrigin);
  const directives = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data:",
    `connect-src 'self' ${connectSrc}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];
  // `frame-ancestors` is dropped for the <meta> copy: a browser logs an error and
  // ignores the directive when it arrives via <meta>. X-Frame-Options from the
  // backend covers any page the backend serves.
  if (!options.meta) directives.push("frame-ancestors 'none'");
  return directives.join('; ');
}