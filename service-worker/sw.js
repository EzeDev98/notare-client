/**
 * Notare's service worker — hand-written, no Workbox.
 *
 * NOTARE-CLIENT-ARCHITECTURE.md §1.4 sizes this at "perhaps 30 lines" for
 * the auth-injection piece specifically; the rest (precache, runtime
 * cache, offline fallback, update flow) is deliberately kept just as
 * plain. Plain JS, not TypeScript — this file runs in the service-worker
 * global scope, which nothing here puts through Vite's normal transform
 * pipeline.
 *
 * NOT served from /public. It lives in this top-level service-worker/
 * folder and is emitted into the build output's root (same place /sw.js
 * needs to be, for the manifest's "/" scope to cover it) by
 * vite-plugins/serviceWorkerVersion.ts's generateBundle hook, which is
 * also what turns CACHE_VERSION below from a literal placeholder into a
 * real value on every production build — see that file for why, and see
 * this file's own CACHE_VERSION comment for what it actually does with it.
 *
 * THREE responsibilities, and no more:
 *   1. App shell + offline fallback (11C)
 *   2. User-approved update flow, never a silent takeover (11D)
 *   3. Attach Authorization to /voice-notes/*\/stream requests (11E, G5)
 *
 * Deliberately does NOT cache /api/* responses. Dexie is already the
 * offline source of truth for notes (features/notes/local) — a second,
 * independent cache of the same JSON would disagree with it eventually
 * and there would be two different answers to "what does this note say
 * offline". The service worker's job is booting the app shell and
 * streaming audio, not re-deciding what Step 7 already owns.
 */

// Stamped automatically by vite-plugins/serviceWorkerVersion.ts on every
// production build (a git short SHA, falling back to a build timestamp if
// git isn't available) — never edit this literal by hand, and don't expect
// it to look like a real version if you open this SOURCE file directly:
// '__NOTARE_SW_VERSION__' only ever gets replaced in the copy that build
// emits to dist/sw.js.
//
// WHY THIS HAS TO CHANGE ON EVERY BUILD AT ALL: a browser detects a service
// worker update purely by re-fetching this script and byte-comparing it
// against the one already installed (per the Service Worker spec) — it
// never looks at PRECACHE_URLS or app code. A deploy that changes only
// application code leaves every OTHER line in this file identical build to
// build, so without something in here changing too, the browser would
// never notice an update happened, no matter how much the app itself
// changed. CACHE_VERSION changing is what makes that byte-comparison see a
// difference — and, as a second job, it's also what makes `activate` evict
// the previous build's SHELL_CACHE and RUNTIME_CACHE, so a browser that
// already installed an older version can't end up stuck serving stale
// precached files offline indefinitely.
const CACHE_VERSION = '__NOTARE_SW_VERSION__';
const SHELL_CACHE = `notare-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `notare-runtime-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

// The whole app shell, precached at install (D-18): every JS/CSS/font/image
// the build emitted, spliced in by vite-plugins/serviceWorkerVersion.ts as a
// JSON array. Like CACHE_VERSION, this literal only exists in the emitted
// dist/sw.js — never edit it by hand.
const BUILD_ASSETS = __NOTARE_PRECACHE__;

// Files with STABLE names that are not part of the bundle.
const PRECACHE_URLS = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/favicon-16.png',
  '/favicon-32.png',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll([...PRECACHE_URLS, ...BUILD_ASSETS])));
  // No self.skipWaiting() here — see the message listener below. 11D
  // wants the person to approve activation (UpdateAvailableModal's
  // "Update now"), not a mid-session takeover nobody asked for.
});

// Set only inside the SKIP_WAITING branch of the message listener below —
// i.e. only when a page's applyUpdate() actually asked this worker to take
// over. Left false, `activate` fires exactly the same on a genuine update
// AND on this worker's very first-ever activation (no incumbent worker to
// replace, so it skips "waiting" and activates on its own) — without this
// gate, self.clients.claim() can't tell those two apart, and on a fresh
// install it ends up claiming the page that just launched, firing an
// unrequested `controllerchange` for no reason. Claiming buys nothing on a
// first install anyway: nothing was controlling that page a moment ago, so
// leaving it uncontrolled until its next navigation costs nothing.
let claimOnActivate = false;

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => {
        if (claimOnActivate) return self.clients.claim();
      }),
  );
});

/*
 * THE ACCESS TOKEN, relayed from the page — a service worker has no
 * access to the tab's in-memory JS state (tokenStore.ts's own doc
 * comment: the access token lives in memory, on purpose, and nowhere
 * else). `authTokenRelay.ts` posts the current token here on every
 * setAccessToken()/clearAccessToken() call.
 *
 * KNOWN LIMITATION, stated plainly rather than hidden: the browser can
 * terminate an idle service worker at any time and respawn it on the next
 * fetch, and this variable does not survive that — it resets to null.
 * The very first voice-stream request after such a respawn (before the
 * page has a chance to re-relay) goes out with no Authorization header,
 * gets a 401 from the server, and the recording simply fails to load
 * until a reload. Given this app's actual usage pattern — a service
 * worker doing real work (handling active fetches) does not go idle —
 * this is a rare edge, not a common failure, and is judged not worth the
 * real complexity of a message round-trip on every stream request just
 * to cover it.
 */
let authToken = null;

/*
 * D-16: the same token, persisted by authTokenRelay.ts in IndexedDB
 * (DB 'notare-sw', store 'auth', key 'token') so it survives this worker
 * being terminated and respawned. Read only when the in-memory copy is
 * empty. Any failure resolves to null — the request then goes out
 * unauthenticated, exactly as before.
 */
function readPersistedToken() {
  return new Promise((resolve) => {
    try {
      const open = indexedDB.open('notare-sw', 1);
      open.onupgradeneeded = () => {
        if (!open.result.objectStoreNames.contains('auth')) open.result.createObjectStore('auth');
      };
      open.onerror = () => resolve(null);
      open.onsuccess = () => {
        const db = open.result;
        try {
          const get = db.transaction('auth', 'readonly').objectStore('auth').get('token');
          get.onsuccess = () => {
            db.close();
            resolve(typeof get.result === 'string' ? get.result : null);
          };
          get.onerror = () => {
            db.close();
            resolve(null);
          };
        } catch {
          db.close();
          resolve(null);
        }
      };
    } catch {
      resolve(null);
    }
  });
}

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'SKIP_WAITING') {
    // The only signal that makes activate's clients.claim() run — see that
    // handler's own comment. Set synchronously, in this same worker
    // instance, before skipWaiting() below hands control to activate.
    claimOnActivate = true;
    self.skipWaiting();
  } else if (data.type === 'AUTH_TOKEN') {
    authToken = typeof data.token === 'string' ? data.token : null;
  } else if (data.type === 'CHECK_OFFLINE') {
    // The installing screen's checks (10d). Answers on the port the page sent.
    const port = event.ports[0];
    if (port) event.waitUntil(checkOffline().then((report) => port.postMessage(report)));
  }
});

/**
 * What this worker really holds, for the onboarding "Checked" lines — looked
 * up in the cache, never assumed:
 *   precached     every file in the build list is in SHELL_CACHE.
 *   opensOffline  the saved page is there AND every script and stylesheet it
 *                 names is too, so launching with no connection would boot.
 */
async function checkOffline() {
  const cache = await caches.open(SHELL_CACHE);

  const wanted = [...PRECACHE_URLS, ...BUILD_ASSETS];
  const hits = await Promise.all(wanted.map((url) => cache.match(url)));
  const precached = hits.every(Boolean);

  let opensOffline = false;
  const shell = (await cache.match(APP_SHELL_KEY)) ?? (await cache.match('/'));
  if (shell) {
    const html = await shell.clone().text();
    const refs = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
    const found = await Promise.all(refs.map((url) => cache.match(url)));
    opensOffline = refs.length > 0 && found.every(Boolean);
  }

  return { precached, opensOffline };
}

function isVoiceStreamRequest(url) {
  return url.pathname.includes('/voice-notes/') && url.pathname.endsWith('/stream');
}

/**
 * G5's whole fix: `<audio src="...">` cannot send an Authorization
 * header, so this attaches it on the request's way out instead. Ranged
 * requests (the Range header a seeking `<audio>` sends) pass through
 * untouched — only the header set changes.
 *
 * Always network, never cached: audio bytes streamed via Range are not
 * something a blanket cache should intercept, and the whole point of
 * this endpoint over the blob-download fallback (features/voice's own
 * doc comment) is that it is NOT fully buffered.
 */
async function handleVoiceStream(request) {
  const headers = new Headers(request.headers);
  const token = authToken ?? (await readPersistedToken());
  if (token !== null) headers.set('Authorization', token);
  return fetch(new Request(request, { headers }));
}

const APP_SHELL_KEY = '/__app-shell__';

/**
 * Network-first. Every SPA route serves the same index.html, so the last good
 * copy is kept under one key and used whenever the network fails: a page load
 * never ends in a browser error page or a service-worker network error, the
 * app simply boots from cache (Dexie holds the data).
 */
async function handleNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      void cache.put(APP_SHELL_KEY, response.clone());
    }
    return response;
  } catch {
    const shell = (await cache.match(APP_SHELL_KEY)) ?? (await cache.match('/'));
    if (shell) return shell;
    const offline = await cache.match(OFFLINE_URL);
    return offline ?? new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

/** Stale-while-revalidate for everything else GET — the app's JS/CSS/
 * images, populated into RUNTIME_CACHE the first time each is fetched. */
async function handleStaticAsset(request) {
  // A cache-only request (the "opens without a connection" check) is answered
  // from the shell cache or not at all — it must never reach the network, or
  // it would pass even when nothing is cached.
  if (request.cache === 'only-if-cached') {
    const { pathname } = new URL(request.url);
    const hit = await caches.match(pathname === '/index.html' ? '/' : request, {
      cacheName: SHELL_CACHE,
    });
    return hit ?? new Response('', { status: 504, statusText: 'Not cached' });
  }

  const cache = await caches.open(RUNTIME_CACHE);
  // Precached shell files live in SHELL_CACHE; anything else seen at runtime
  // in RUNTIME_CACHE.
  const cached =
    (await caches.match(request, { cacheName: SHELL_CACHE })) ?? (await cache.match(request));

  const network = fetch(request)
    .then((response) => {
      if (response.ok) void cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);

  if (cached) {
    // Update the cache in the background; the caller gets the fast answer.
    void network;
    return cached;
  }

  const fresh = await network;
  return fresh ?? new Response('', { status: 504, statusText: 'Unavailable' });
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (isVoiceStreamRequest(url)) {
    event.respondWith(handleVoiceStream(event.request));
    return;
  }

  // Never intervene on API calls beyond the stream case above — see the
  // file's own doc comment on why this service worker does not cache
  // /api/* at all.
  if (url.pathname.startsWith('/api/')) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(handleNavigation(event.request));
    return;
  }

  if (event.request.method === 'GET') {
    event.respondWith(handleStaticAsset(event.request));
  }
});
