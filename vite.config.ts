/** Vite and Vitest configuration. */
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { patternflyLayerPlugin } from './vite-plugins/patternflyLayer';
import { serviceWorkerVersionPlugin } from './vite-plugins/serviceWorkerVersion';

export default defineConfig(({ mode }) => {
  const nodeEnv = loadEnv(mode, process.cwd(), '');
  const proxyTarget = nodeEnv['NOTARE_DEV_PROXY_TARGET'] ?? 'http://localhost:2001';

  const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

  return {
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },

    build: { chunkSizeWarningLimit: 1500 },

    plugins: [patternflyLayerPlugin(), react(), serviceWorkerVersionPlugin()],

    resolve: {
      alias: [
        { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
        { find: '~', replacement: fileURLToPath(new URL('./tests', import.meta.url)) },
        {
          find: /^@patternfly\/react-icons$/,
          replacement: fileURLToPath(
            new URL('./src/design-system/icons/lucide-patternfly-icons.tsx', import.meta.url),
          ),
        },
      ],
    },

    test: {
      environment: 'jsdom',

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
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
