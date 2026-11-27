/** Vite plugin that copies the service worker into the build with a fresh cache version. */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import type { Plugin } from 'vite';

export function serviceWorkerVersionPlugin(): Plugin {
  return {
    name: 'notare:sw-version',
    apply: 'build',
    generateBundle(_options, bundle) {
      const template = readFileSync(SOURCE_PATH, 'utf8');

      for (const placeholder of [PLACEHOLDER, PRECACHE_PLACEHOLDER]) {
        if (!template.includes(placeholder)) {
          throw new Error(
            `service-worker/sw.js: expected to find ${placeholder} to stamp — has its declaration changed?`,
          );
        }
      }

      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: template
          .replaceAll(PLACEHOLDER, readBuildVersion())
          .replaceAll(PRECACHE_PLACEHOLDER, JSON.stringify(collectPrecacheUrls(Object.keys(bundle)))),
      });
    },
  };
}

const SOURCE_PATH = fileURLToPath(new URL('../service-worker/sw.js', import.meta.url));
const PLACEHOLDER = '__NOTARE_SW_VERSION__';
const PRECACHE_PLACEHOLDER = '__NOTARE_PRECACHE__';

const PUBLIC_SHELL_FILES = [
  '/',
  '/offline.html',
  '/fonts/red-hat-text-latin-400-normal.woff2',
  '/fonts/red-hat-text-latin-ext-400-normal.woff2',
];

function collectPrecacheUrls(bundleFileNames: string[]): string[] {
  const emitted = bundleFileNames
    .filter((name) => /.(js|css|woff2?|png|svg|webp|webmanifest)$/.test(name))
    .map((name) => `/${name}`);

  return [...new Set([...PUBLIC_SHELL_FILES, ...emitted])];
}

function readBuildVersion(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return Date.now().toString(36);
  }
}
