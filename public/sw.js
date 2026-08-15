/**
 * Notare's service worker — hand-written, no Workbox.
 *
 * NOTARE-CLIENT-ARCHITECTURE.md §1.4 sizes this at "perhaps 30 lines" for
 * the auth-injection piece specifically; the rest (precache, runtime
 * cache, offline fallback, update flow) is deliberately kept just as
 * plain. Plain JS, not TypeScript — this file is served as-is from
 * /public and runs in the service-worker global scope, which Vite does
 * not transpile.
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

// Bumped v1 -> v2 -> v3 as PRECACHE_URLS changed each time (icons.svg ->
// icon.svg -> the real PNG logo's five sizes now). A version bump is what
// makes `activate` evict the old SHELL_CACHE that still holds the stale
// precached file list — without it, a browser that already installed an
// older version keeps serving its old cached files offline indefinitely,
// since `install` only re-runs addAll() for a cache name it has not seen
// before.
const CACHE_VERSION = 'v3';
const SHELL_CACHE = `notare-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `notare-runtime-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

// Only files with STABLE names — anything Vite outputs from `src/` is
// hashed per build, so there is no fixed list of "the app's JS/CSS" to
// precache here. Those are instead added to RUNTIME_CACHE the first time
// each is actually requested (see handleStaticAsset below) — a repeat
// visit works offline; a genuinely first visit to a brand-new route on a
// dead connection does not, which is the honest limit of this approach
// without a build-time manifest (Workbox's job, not taken on here).
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
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)));
  // No self.skipWaiting() here — see the message listener below. 11D
  // wants the person to approve activation (UpdateBanner's "Refresh"),
  // not a mid-session takeover nobody asked for.
});

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
      .then(() => self.clients.claim()),
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

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (data.type === 'AUTH_TOKEN') {
    authToken = typeof data.token === 'string' ? data.token : null;
  }
});

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
  if (authToken !== null) headers.set('Authorization', authToken);
  return fetch(new Request(request, { headers }));
}

/** Network-first; falls back to the precached offline page. */
async function handleNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    const offline = await cache.match(OFFLINE_URL);
    return offline ?? Response.error();
  }
}

/** Stale-while-revalidate for everything else GET — the app's JS/CSS/
 * images, populated into RUNTIME_CACHE the first time each is fetched. */
async function handleStaticAsset(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

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
  return fresh ?? Response.error();
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
