/**
 * Captures `beforeinstallprompt` so the app can show its own "Install
 * Notare" UI instead of relying on the browser's own (increasingly
 * inconsistent, and on many current Chrome/Android builds no longer
 * automatic) install affordance.
 *
 * This is also, not incidentally, a diagnostic: if this event never
 * fires on a device/browser that supports it, that is the browser
 * telling us — definitively, not by inference from reading source code
 * — that it does not currently consider the app installable. Watch for
 * `console.debug('[pwa] beforeinstallprompt fired')` in devtools/remote
 * debugging as the ground truth for that question.
 *
 * Not fired at all, ever, on iOS Safari — there is no such event there.
 * See InstallPage's InstallInstructions for how iOS is handled instead
 * (Step 5b: InstallBanner, which used to hold this note, is deleted).
 */

// Minimal shape of the (non-standard, Chromium-only) BeforeInstallPromptEvent.
// Not in lib.dom.d.ts, hence the local interface instead of a global type.
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

type InstallListener = (available: boolean) => void;

let deferredEvent: BeforeInstallPromptEvent | null = null;
let dismissedOrInstalled = false;
const listeners = new Set<InstallListener>();

function notify(available: boolean): void {
  for (const listener of listeners) listener(available);
}

/**
 * Subscribes to install-availability. Replays current state immediately,
 * same reasoning as `onUpdateAvailable` in registerServiceWorker.ts — a
 * component mounting after the event already fired must not wait for a
 * second one that will never come (this event fires at most once per
 * page load per the spec).
 */
export function onInstallAvailable(listener: InstallListener): () => void {
  listeners.add(listener);
  listener(deferredEvent !== null && !dismissedOrInstalled);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Step 1b. Synchronous read of the same availability state
 * `onInstallAvailable` replays asynchronously via listener. Boot
 * orchestration (App.tsx's bootPhase computation) needs this value on
 * the very first render — before any effect has had a chance to run —
 * so it doesn't render one frame of the wrong phase (e.g. flashing
 * `ready` before flipping to `install`). Effect-based consumers
 * (InstallPage, via useInstallPrompt) should keep subscribing through
 * `onInstallAvailable`/`useInstallPrompt` instead; this getter exists
 * for the boot path only.
 */
export function getInstallAvailability(): boolean {
  return deferredEvent !== null && !dismissedOrInstalled;
}

/**
 * Shows the browser's native install dialog using the captured event.
 * Can only be called from a user gesture (a click handler) — the spec
 * requires it; calling it elsewhere silently does nothing.
 */
export async function promptInstall(): Promise<void> {
  if (deferredEvent === null) return;
  const event = deferredEvent;
  // The captured event is single-use regardless of outcome.
  deferredEvent = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  console.debug(`[pwa] install prompt outcome: ${outcome}`);
  dismissedOrInstalled = true;
  notify(false);
}

/**
 * Called once at app startup (main.tsx), same as registerServiceWorker.
 * No PROD gate here on purpose: unlike the service worker (which has a
 * documented HMR-breaking interaction with Vite dev), listening for this
 * event in dev is harmless and lets install UX be iterated on locally.
 */
export function initInstallPrompt(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('beforeinstallprompt', (event) => {
    // Stop the browser's own default UI (mini-infobar / omnibox prompt)
    // so ours is the only one shown — same tradeoff UpdateAvailableModal
    // makes relative to the toast system: one deliberate surface, not two
    // competing ones.
    event.preventDefault();
    deferredEvent = event as BeforeInstallPromptEvent;
    dismissedOrInstalled = false;
    console.debug('[pwa] beforeinstallprompt fired — app is installable');
    notify(true);
  });

  // Fired after a successful install, from either our prompt or (if a
  // browser ever shows its own UI in parallel on some platform) that
  // one. Either way, stop offering to install something already
  // installed.
  window.addEventListener('appinstalled', () => {
    console.debug('[pwa] appinstalled');
    deferredEvent = null;
    dismissedOrInstalled = true;
    notify(false);
  });
}
