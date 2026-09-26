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
    },
  };
});
