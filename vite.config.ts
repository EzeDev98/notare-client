// defineConfig from vitest/config is a superset of Vite's — same function,
// plus types for the `test` key below. loadEnv is not re-exported, so it still
// comes from vite itself.
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { patternflyLayerPlugin } from './vite-plugins/patternflyLayer';
import { serviceWorkerVersionPlugin } from './vite-plugins/serviceWorkerVersion';

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

  const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

  return {
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },

    // serviceWorkerVersionPlugin only ever runs for `vite build` (its own
    // `apply: 'build'`) — see service-worker/sw.js and
    // vite-plugins/serviceWorkerVersion.ts for why sw.js needs a plugin at
    // all instead of just living in /public like every other static file.
    build: { chunkSizeWarningLimit: 1500 },

    plugins: [patternflyLayerPlugin(), react(), serviceWorkerVersionPlugin()],

    resolve: {
      alias: [
        /*
         * The bundler's half of the path alias. tsconfig paths teaches the
         * TYPE CHECKER what "@/lib/http" means; this teaches the BUNDLER where
         * to load it from. Two programs, neither reads the other's config.
         */
        { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
        /*
         * Test-only helpers live outside src/, so @/ cannot reach them. Their
         * own alias, rather than deep relative paths: 1C bans those because
         * "../../../../tests/msw/server" hides which layer it crosses, and a
         * test importing fixtures is crossing one every time.
         */
        { find: '~', replacement: fileURLToPath(new URL('./tests', import.meta.url)) },
        /*
         * Redirects every `import { XIcon } from '@patternfly/react-icons'`
         * in src/ to Lucide equivalents — the ONE place that swap happens;
         * see the shim file's own header comment for the full rationale.
         *
         * The `^...$` RegExp is deliberate and load-bearing: a plain string
         * key here would ALSO match `@patternfly/react-icons/dist/esm/...`
         * (Vite/@rollup/plugin-alias treats a string find as a prefix,
         * matching the exact string or that string + '/'), which would
         * hijack PatternFly's OWN internal icon imports inside
         * @patternfly/react-core (e.g. Alert's status icons) and break
         * them, since those are all deep imports, not this bare specifier.
         * The regex matches only the exact bare import, leaving every deep
         * import PatternFly uses internally completely untouched.
         */
        {
          find: /^@patternfly\/react-icons$/,
          replacement: fileURLToPath(
            new URL('./src/design-system/icons/lucide-patternfly-icons.tsx', import.meta.url),
          ),
        },
      ],
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
