/**
 * Registration + THE UPDATE FLOW (11D).
 *
 * A new service worker installs in the background and sits WAITING —
 * `sw.js` never calls `self.skipWaiting()` on its own. This module is the
 * only thing that unblocks it, and only in response to `applyUpdate()`,
 * called from `UpdateAvailableModal` once a person actually clicks
 * "Update now". Nothing here takes over a session nobody asked to
 * interrupt mid-edit.
 */

type UpdateListener = (available: boolean) => void;

let waitingWorker: ServiceWorker | null = null;
const listeners = new Set<UpdateListener>();

function notify(available: boolean): void {
  for (const listener of listeners) listener(available);
}

/**
 * Subscribes to update-availability. Replays the CURRENT state
 * immediately on subscribe — a component mounting after the update was
 * already detected (e.g. `UpdateAvailableModal` rendering fresh on a
 * route change) must not have to wait for a second `updatefound` that
 * will never come.
 */
export function onUpdateAvailable(listener: UpdateListener): () => void {
  listeners.add(listener);
  listener(waitingWorker !== null);
  return () => {
    listeners.delete(listener);
  };
}

// Set only by applyUpdate() below — the single signal the controllerchange
// listener uses to tell "the user approved this update" apart from
// sw.js's activate handler calling self.clients.claim() on its own, which
// also fires controllerchange but happens on EVERY first-ever activation
// (a brand-new install has no prior controller, so the new worker skips
// waiting and activates immediately, claiming whatever page is open). That
// case must never reload — see the module doc comment.
let updateRequested = false;

export function applyUpdate(): void {
  if (waitingWorker === null) return;
  updateRequested = true;
  waitingWorker.postMessage({ type: 'SKIP_WAITING' });
}

/**
 * Called once at app startup (`main.tsx`). No-ops outright in a browser
 * without service worker support — the app already works without one;
 * it only loses offline boot and the voice-auth-injection workaround.
 *
 * PRODUCTION ONLY (`import.meta.env.PROD`). This was missing initially and
 * caused a real, confusing bug: registered in Vite DEV mode, the service
 * worker's stale-while-revalidate caching (sw.js's `handleStaticAsset`)
 * intercepts Vite's own dev-server module fetches. Vite dev serves ES
 * modules that change on every HMR update and on every server restart —
 * a cached chunk from one moment can end up served alongside fresh chunks
 * from the next, and two different module graphs' copies of React
 * disagreeing about internal hook state is exactly what produces
 * "Invalid hook call: Cannot read properties of null (reading
 * 'useState')" — in code that never changed and has nothing wrong with
 * it. The fix is not touching sw.js's caching logic at all; it is simply
 * never installing a service worker while iterating against the dev
 * server, which is what every other service-worker-based Vite setup does
 * for the same reason.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // A worker was ALREADY waiting when this tab loaded (e.g. a
        // previous tab installed an update and this one just opened).
        if (registration.waiting) {
          waitingWorker = registration.waiting;
          notify(true);
        }

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;

          installing.addEventListener('statechange', () => {
            /*
             * `installed` + an existing controller means this is an
             * UPDATE to an already-running app, not the very first
             * install (which also reaches `installed` but has no
             * controller yet, and nothing to "update" from — that
             * first install should not prompt anyone about itself).
             */
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              waitingWorker = installing;
              notify(true);
            }
          });
        });
      })
      .catch(() => {
        // Registration failing (unsupported browser, blocked by policy,
        // served over plain HTTP) is not fatal — see this function's own
        // doc comment.
      });

    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // Ignore controllerchange that didn't come from an approved
      // applyUpdate() — most importantly the one sw.js's activate handler
      // triggers via self.clients.claim() on a brand-new install, which
      // has nothing to "update" from and must not reload the tab that
      // just launched.
      if (!updateRequested) return;
      // Fires once per activation, in principle — guarded anyway against
      // a double reload if a browser ever fires it more than once.
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
  });
}
