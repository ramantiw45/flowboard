import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `global: 'window'` polyfill is required by sockjs-client in the browser.
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Content-Security-Policy for the document.
 *
 * The backend is a pure JSON API and serves no HTML, so a CSP set there would
 * never be evaluated by a browser. The policy that actually protects the app
 * has to travel with the document, which is why it is defined here and applied
 * to the dev/preview server AND injected into the production build.
 *
 * The directives are derived from what the app actually loads, not guesses:
 *  - `script-src` omits 'unsafe-inline' and 'unsafe-eval'. There is no inline
 *    <script> and no eval()/new Function() anywhere in src, so neither is
 *    needed.
 *  - `style-src` keeps 'unsafe-inline' because React sets inline style
 *    attributes, and Google Fonts is loaded as a stylesheet.
 *  - `connect-src` lists the API and the SockJS/STOMP endpoint, both of which
 *    default to http://localhost:8080 per src/api/client.ts. Both must stay in
 *    step with API_BASE_URL/WS_URL; tools/cspcheck.mjs fails when they do not,
 *    because a stale origin here silently breaks every fetch and socket.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data:",
  "connect-src 'self' http://localhost:8080 ws://localhost:8080",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

/**
 * The same policy minus header-only directives, for the <meta> copy.
 * `frame-ancestors` is dropped because a browser logs an error and ignores it
 * when it arrives via <meta>; X-Frame-Options from the backend covers any page
 * the backend serves.
 */
const CSP_META = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data:",
  "connect-src 'self' http://localhost:8080 ws://localhost:8080",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

/** Sends the CSP as a response header while the dev/preview server runs. */
function cspDevServer(): Plugin {
  const apply = (_req: unknown, res: { setHeader(k: string, v: string): void }, next: () => void) => {
    res.setHeader('Content-Security-Policy', CSP);
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
function cspMetaTag(): Plugin {
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
              attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP_META },
              injectTo: 'head-prepend' as const,
            },
          ],
        };
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), cspDevServer(), cspMetaTag()],
  define: {
    global: 'window',
  },
  server: {
    port: 5173,
  },
});
