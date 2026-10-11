/**
 * Hands the current access token to the service worker, so `sw.js` can
 * attach it to `/voice-notes/*\/stream` requests — a service worker has no
 * access to this tab's in-memory JS state.
 *
 * Two channels, on purpose (D-16):
 *  - postMessage to the active controller: instant, keeps the worker's
 *    in-memory copy current.
 *  - IndexedDB (DB 'notare-sw', store 'auth', key 'token'): survives the
 *    browser terminating and respawning an idle worker, and works even when
 *    no worker controls the page yet. sw.js falls back to it whenever its
 *    in-memory copy is empty. Cleared on logout; removed by hardReset.
 *
 * Called from `tokenStore.ts`'s `setAccessToken`/`clearAccessToken` — the
 * one place every path that changes the token already goes through.
 */
const DB_NAME = 'notare-sw';
const STORE = 'auth';
const KEY = 'token';

export function relayAuthTokenToServiceWorker(token: string | null): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  void persistToken(token);

  navigator.serviceWorker.controller?.postMessage({ type: 'AUTH_TOKEN', token });
}

function persistToken(token: string | null): Promise<void> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve();
      return;
    }

    try {
      const open = indexedDB.open(DB_NAME, 1);
      open.onupgradeneeded = () => {
        if (!open.result.objectStoreNames.contains(STORE)) open.result.createObjectStore(STORE);
      };
      open.onerror = () => resolve();
      open.onsuccess = () => {
        const db = open.result;
        try {
          const tx = db.transaction(STORE, 'readwrite');
          const store = tx.objectStore(STORE);
          if (token === null) store.delete(KEY);
          else store.put(token, KEY);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = tx.onabort = () => {
            db.close();
            resolve();
          };
        } catch {
          db.close();
          resolve();
        }
      };
    } catch {
      resolve();
    }
  });
}
