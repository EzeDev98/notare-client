/** Registers the service worker and handles updates. */
type UpdateListener = (available: boolean) => void;

let waitingWorker: ServiceWorker | null = null;
let activeRegistration: ServiceWorkerRegistration | null = null;
const listeners = new Set<UpdateListener>();

function notify(available: boolean): void {
  for (const listener of listeners) listener(available);
}

export function onUpdateAvailable(listener: UpdateListener): () => void {
  listeners.add(listener);
  listener(waitingWorker !== null);
  return () => {
    listeners.delete(listener);
  };
}

let updateRequested = false;

export async function checkForUpdates(): Promise<'latest' | 'available'> {
  if (waitingWorker !== null) return 'available';
  if (activeRegistration === null) return 'latest';
  await activeRegistration.update();
  const installing = activeRegistration.installing;
  if (installing !== null) {
    await new Promise<void>((resolve) => {
      const timer = window.setTimeout(resolve, 10_000);
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' || installing.state === 'redundant') {
          window.clearTimeout(timer);
          resolve();
        }
      });
    });
  }
  return waitingWorker !== null ? 'available' : 'latest';
}

export function applyUpdate(): void {
  if (waitingWorker === null) return;
  updateRequested = true;
  waitingWorker.postMessage({ type: 'SKIP_WAITING' });
}

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        activeRegistration = registration;
        if (registration.waiting) {
          waitingWorker = registration.waiting;
          notify(true);
        }

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;

          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              waitingWorker = installing;
              notify(true);
            }
          });
        });
      })
      .catch(() => {});

    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!updateRequested) return;
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
  });
}
