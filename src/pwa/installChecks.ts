import { INSTALL_CHECK_TIMEOUT_MS } from '@/core/config/timings';

/**
 * The three "Checked" lines on the installing screen (master 6.2, D-18). Each
 * one asks the browser, so a line only turns green when what it says is true.
 * A check that cannot find out answers false: a failure is shown as a failure.
 */

/** What the service worker finds in its own cache when asked (sw.js, CHECK_OFFLINE). */
interface OfflineReport {
  /** Every file listed at build time is in the shell cache. */
  precached: boolean;
  /** The saved page and every script and style it names are in the shell cache. */
  opensOffline: boolean;
}

const NOTHING: OfflineReport = { precached: false, opensOffline: false };

const timeout = (ms: number): Promise<'timeout'> =>
  new Promise((resolve) => {
    setTimeout(() => {
      resolve('timeout');
    }, ms);
  });

/** Asks the active worker what it has cached. Never rejects; no answer in time is "nothing". */
async function askWorker(): Promise<OfflineReport> {
  if (!('serviceWorker' in navigator)) return NOTHING;
  // No registration at all (a dev server, a blocked worker): nothing will ever be ready.
  if (!(await navigator.serviceWorker.getRegistration())) return NOTHING;

  const registration = await Promise.race([navigator.serviceWorker.ready, timeout(INSTALL_CHECK_TIMEOUT_MS)]);
  if (registration === 'timeout' || !registration.active) return NOTHING;

  const worker = registration.active;
  return new Promise<OfflineReport>((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => {
      resolve(NOTHING);
    }, INSTALL_CHECK_TIMEOUT_MS);
    channel.port1.onmessage = (event: MessageEvent<OfflineReport>) => {
      clearTimeout(timer);
      resolve(event.data);
    };
    worker.postMessage({ type: 'CHECK_OFFLINE' }, [channel.port2]);
  });
}

let report: Promise<OfflineReport> | null = null;

/** One question to the worker, shared by checks 1 and 3. */
function offlineReport(): Promise<OfflineReport> {
  report ??= askWorker();
  return report;
}

/** Forget the last answer, so a new run asks again. */
export function resetInstallChecks(): void {
  report = null;
}

/** Check 1: the worker is ready and the whole app is in its cache. */
export async function checkPrecache(): Promise<boolean> {
  return (await offlineReport()).precached;
}

/**
 * Check 3: the app would open with no connection. The worker confirms the saved
 * page and everything it loads are cached. When this page is already under the
 * worker's control it also fetches /index.html cache-only through it, the same
 * path an offline launch takes, and the file has to come back.
 */
export async function checkOpensOffline(): Promise<boolean> {
  if (!(await offlineReport()).opensOffline) return false;
  if (!navigator.serviceWorker.controller) return true;
  try {
    const response = await fetch('/index.html', { cache: 'only-if-cached', mode: 'same-origin' });
    return response.ok;
  } catch {
    return false;
  }
}

export interface StorageResult {
  /** The browser has room for notes on this device. */
  available: boolean;
  /** The browser promises not to clear them. */
  persisted: boolean;
}

/** Check 2: asks for persistent storage and for how much room there is. */
export async function checkStorage(): Promise<StorageResult> {
  if (!('storage' in navigator)) return { available: false, persisted: false };
  try {
    const { storage } = navigator;
    const persisted = (await storage.persisted()) || (await storage.persist());
    const { quota = 0 } = await storage.estimate();
    return { available: quota > 0, persisted };
  } catch {
    return { available: false, persisted: false };
  }
}
