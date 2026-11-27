/** Service worker: precaches the app, serves it offline and adds the access token to voice clip streams. */
const CACHE_VERSION = '__NOTARE_SW_VERSION__';
const SHELL_CACHE = `notare-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `notare-runtime-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

const BUILD_ASSETS = __NOTARE_PRECACHE__;

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
});

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

let authToken = null;

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
    claimOnActivate = true;
    self.skipWaiting();
  } else if (data.type === 'AUTH_TOKEN') {
    authToken = typeof data.token === 'string' ? data.token : null;
  } else if (data.type === 'CHECK_OFFLINE') {
    const port = event.ports[0];
    if (port) event.waitUntil(checkOffline().then((report) => port.postMessage(report)));
  }
});

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

async function handleVoiceStream(request) {
  const headers = new Headers(request.headers);
  const token = authToken ?? (await readPersistedToken());
  if (token !== null) headers.set('Authorization', token);
  return fetch(new Request(request, { headers }));
}

const APP_SHELL_KEY = '/__app-shell__';

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

async function handleStaticAsset(request) {
  if (request.cache === 'only-if-cached') {
    const { pathname } = new URL(request.url);
    const hit = await caches.match(pathname === '/index.html' ? '/' : request, {
      cacheName: SHELL_CACHE,
    });
    return hit ?? new Response('', { status: 504, statusText: 'Not cached' });
  }

  const cache = await caches.open(RUNTIME_CACHE);
  const cached =
    (await caches.match(request, { cacheName: SHELL_CACHE })) ?? (await cache.match(request));

  const network = fetch(request)
    .then((response) => {
      if (response.ok) void cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);

  if (cached) {
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

  if (url.pathname.startsWith('/api/')) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(handleNavigation(event.request));
    return;
  }

  if (event.request.method === 'GET') {
    event.respondWith(handleStaticAsset(event.request));
  }
});
