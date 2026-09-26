// `global: 'window'` polyfill is required by sockjs-client in the browser.
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { buildCsp, resolveEndpoints } from './src/config/endpoints';

/**
 * Sends the CSP as a response header while the dev/preview server runs.
 * The policy is built from the same resolved endpoints the app calls, so the
 * two cannot drift (see src/config/endpoints.ts).
 */
function cspDevServer(csp: string): Plugin {
  const apply = (_req: unknown, res: { setHeader(k: string, v: string): void }, next: () => void) => {
    res.setHeader('Content-Security-Policy', csp);
    next();
  };
  return {
    name: 'csp-dev-server',
    configureServer(server) {
      server.middlewares.use(apply);
    },
    configurePreviewServer(server) {
      server.middlewares.use(apply);
    },
  };
}

/**
 * Injects a <meta http-equiv="Content-Security-Policy"> into the built
 * index.html. A meta CSP is weaker than a header (frame-ancestors is ignored
 * and it does not cover the response before it is parsed), so production
 * should also send the header from whatever serves the static files. This
 * exists so a plain `vite build` plus any static host is not left with no
 * policy at all.
 */
function cspMetaTag(cspMeta: string): Plugin {
  return {
    name: 'csp-meta-tag',
    transformIndexHtml: {
      order: 'post',
      handler(html: string) {
        return {
          html,
          tags: [
            {
              tag: 'meta',
              attrs: { 'http-equiv': 'Content-Security-Policy', content: cspMeta },
              injectTo: 'head-prepend' as const,
            },
          ],
        };
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  // Empty prefix: these are read directly rather than through import.meta.env,
  // so the config and the app resolve them from one function.
  const env = loadEnv(mode, process.cwd(), '');
  const { apiBaseUrl, wsUrl } = resolveEndpoints(env);

  return {
    plugins: [
      react(),
      cspDevServer(buildCsp(apiBaseUrl, wsUrl)),
      cspMetaTag(buildCsp(apiBaseUrl, wsUrl, { meta: true })),
    ],
    define: {
      global: 'window',
    },
    server: {
      port: 5173,
      proxy: devProxy(apiBaseUrl),
    },
    // The preview server serves the production build, and the same cookie
    // reasoning applies, so it gets the same proxy. Without it, `vite preview`
    // cannot exercise the cookie session at all - the app would talk to the API
    // cross-origin and every request would arrive without its cookie.
    preview: {
      port: 4173,
      proxy: devProxy(apiBaseUrl),
    },
  };
});

/**
 * Same-origin proxy for the API and the WebSocket.
 *
 * This is required by the HttpOnly cookie session, not a convenience. A
 * `SameSite=Lax` cookie is withheld from cross-site XHR, so a browser loading
 * the app from one port while the API is on another will store the cookie and
 * then refuse to send it - measured in Chrome: the cookie was in the store
 * (httpOnly=true, path=/api) and `GET /api/auth/me` still answered 401.
 * `SameSite=None` is not an escape hatch here, because it requires `Secure`,
 * which needs real HTTPS.
 *
 * Proxying makes the app same-origin with the API, so `Lax` works as intended
 * and CSRF protection stays meaningful rather than being switched off to
 * compensate.
 */
function devProxy(apiBaseUrl: string) {
  const target = devApiOrigin(apiBaseUrl);
  return {
    '/api': {
      target,
      changeOrigin: true,
    },
    // SockJS needs an unbuffered upgrade, or the handshake stalls.
    '/ws-board': {
      target,
      changeOrigin: true,
      ws: true,
    },
  };
}

/** Origin (no path) of the backend, for the proxy. */
function devApiOrigin(apiBaseUrl: string): string {
  try {
    return new URL(apiBaseUrl, 'http://localhost:8080').origin;
  } catch {
    return 'http://localhost:8080';
  }
}
