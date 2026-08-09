// defineConfig from vitest/config is a superset of Vite's — same function,
// plus types for the `test` key below. loadEnv is not re-exported, so it still
// comes from vite itself.
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ mode }) => {
  /*
   * The third argument is the prefix filter, and '' means "no filter — load
   * everything". Client code only ever sees VITE_-prefixed variables; this
   * file runs in NODE, so it can read the rest. That asymmetry is the whole
   * reason NOTARE_DEV_PROXY_TARGET can configure the dev server without ever
   * reaching the browser.
   */
  const nodeEnv = loadEnv(mode, process.cwd(), '');
  const proxyTarget = nodeEnv['NOTARE_DEV_PROXY_TARGET'] ?? 'http://localhost:2001';

  return {
    plugins: [react()],

    resolve: {
      alias: {
        /*
         * The bundler's half of the path alias. tsconfig paths teaches the
         * TYPE CHECKER what "@/lib/http" means; this teaches the BUNDLER where
         * to load it from. Two programs, neither reads the other's config.
         */
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        /*
         * Test-only helpers live outside src/, so @/ cannot reach them. Their
         * own alias, rather than deep relative paths: 1C bans those because
         * "../../../../tests/msw/server" hides which layer it crosses, and a
         * test importing fixtures is crossing one every time.
         */
        '~': fileURLToPath(new URL('./tests', import.meta.url)),
      },
    },

    /*
     * Vitest reads THIS config, so the @/ alias above already applies to tests.
     * One alias definition now serves three programs: tsc, Vite and Vitest.
     */
    test: {
      // jsdom is a DOM implementation in Node, not a browser. It has no layout
      // engine (getBoundingClientRect returns zeros) and no IndexedDB or Web
      // Locks — Steps 7 and 8 will need fake-indexeddb and a locks stub.
      environment: 'jsdom',

      /*
       * An ABSOLUTE base URL under test, unlike the relative "/api/v1" the dev
       * proxy uses (1D).
       *
       * Node's fetch has no document to resolve a relative URL against — it
       * throws before a request is ever made, and before MSW could intercept
       * it. A browser resolves against location; Node has no location.
       *
       * Nothing here reaches a real server: MSW intercepts everything, and
       * onUnhandledRequest is set to error so an unmatched path fails loudly
       * rather than escaping to the network.
       */
      env: {
        VITE_API_BASE_URL: 'http://localhost:2001/api/v1',
        VITE_SERVER_TIME_ZONE: 'Africa/Lagos',
      },
      globals: false,
      setupFiles: ['./tests/setup.ts'],
      css: false,
    },

    server: {
      proxy: {
        /*
         * The client calls a same-origin path (/api/v1/notes) and this
         * forwards it to Spring. The backend's CORS already permits
         * localhost:*, so this is not strictly required — it is better anyway:
         * no preflight on every request, dev traffic has the same shape as
         * production behind a reverse proxy, and CORS misconfiguration cannot
         * be something we only discover in staging.
         *
         * No rewrite: Spring already serves under /api/v1 (app.title), so the
         * path passes through untouched.
         */
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
