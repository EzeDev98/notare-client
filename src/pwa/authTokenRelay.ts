/** Gives the access token to the service worker. */
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
