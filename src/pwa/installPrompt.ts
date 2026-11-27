/** Captures the browser's install prompt so the app can show its own. */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

type InstallListener = (available: boolean) => void;

let deferredEvent: BeforeInstallPromptEvent | null = null;
let dismissedOrInstalled = false;
const listeners = new Set<InstallListener>();

function notify(available: boolean): void {
  for (const listener of listeners) listener(available);
}

export function onInstallAvailable(listener: InstallListener): () => void {
  listeners.add(listener);
  listener(deferredEvent !== null && !dismissedOrInstalled);
  return () => {
    listeners.delete(listener);
  };
}

export function getInstallAvailability(): boolean {
  return deferredEvent !== null && !dismissedOrInstalled;
}

export async function promptInstall(): Promise<InstallOutcome> {
  if (deferredEvent === null) return 'unavailable';
  const event = deferredEvent;
  deferredEvent = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  console.debug(`[pwa] install prompt outcome: ${outcome}`);
  dismissedOrInstalled = true;
  notify(false);
  return outcome;
}

export function initInstallPrompt(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredEvent = event as BeforeInstallPromptEvent;
    dismissedOrInstalled = false;
    console.debug('[pwa] beforeinstallprompt fired — app is installable');
    notify(true);
  });

  window.addEventListener('appinstalled', () => {
    console.debug('[pwa] appinstalled');
    deferredEvent = null;
    dismissedOrInstalled = true;
    notify(false);
  });
}
