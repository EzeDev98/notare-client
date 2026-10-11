import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import type { Plugin } from 'vite';

/**
 * Emits service-worker/sw.js into the build output as /sw.js, stamping its
 * CACHE_VERSION placeholder with a fresh value on every production build —
 * see that file's own CACHE_VERSION comment for why a value that changes on
 * every build matters at all (short version: it's the only thing that makes
 * the browser's own update check notice a deploy happened).
 *
 * NOT in /public, on purpose: Vite copies that directory to the output root
 * verbatim, on its own schedule, which this plugin has no reliable way to
 * run after — and running before would mean Vite's copy overwrites the
 * stamped file with the raw placeholder right after. Rollup's `emitFile`
 * during `generateBundle`, on the other hand, is the officially supported
 * way to add a file to the same output Rollup is about to write, so there
 * is exactly one writer for dist/sw.js and no ordering to get wrong.
 * `fileName` (not `name`) is what asks Rollup for that exact path, unhashed
 * — a service worker's URL has to be stable for the browser to keep
 * re-checking it.
 */
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

/** Files in /public that the app needs but that never pass through the bundle. */
const PUBLIC_SHELL_FILES = [
  '/',
  '/offline.html',
  '/fonts/red-hat-text-latin-400-normal.woff2',
  '/fonts/red-hat-text-latin-ext-400-normal.woff2',
];

/**
 * The whole app shell, known only at build time: every hashed JS/CSS/font/
 * image Rollup emitted (lazy route chunks included, so a deep link works
 * offline on the very first visit) plus the unhashed public files above.
 * Source maps and index.html are left out — the shell document is cached
 * under '/' and refreshed by handleNavigation.
 */
function collectPrecacheUrls(bundleFileNames: string[]): string[] {
  const emitted = bundleFileNames
    .filter((name) => /.(js|css|woff2?|png|svg|webp|webmanifest)$/.test(name))
    .map((name) => `/${name}`);

  return [...new Set([...PUBLIC_SHELL_FILES, ...emitted])];
}

/**
 * A git short SHA, not a timestamp: reproducible for a given commit (so
 * rebuilding the same commit twice doesn't spuriously "update" someone
 * already on it), and it doubles as a direct pointer from "which cache
 * version is this user's console showing me" to the commit that shipped
 * it. Falls back to a timestamp only if `git` itself is unavailable — e.g.
 * a source archive deployed without its .git directory — where a working
 * but less traceable version beats a build that fails outright.
 */
function readBuildVersion(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return Date.now().toString(36);
  }
}
