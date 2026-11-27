/** The checks shown while the app installs. */
import { INSTALL_CHECK_TIMEOUT_MS } from '@/core/config/timings';

interface OfflineReport {
  precached: boolean;
  opensOffline: boolean;
}

const NOTHING: OfflineReport = { precached: false, opensOffline: false };

const timeout = (ms: number): Promise<'timeout'> =>
  new Promise((resolve) => {
    setTimeout(() => {
      resolve('timeout');
    }, ms);
  });

async function askWorker(): Promise<OfflineReport> {
  if (!('serviceWorker' in navigator)) return NOTHING;
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

function offlineReport(): Promise<OfflineReport> {
  report ??= askWorker();
  return report;
}

export function resetInstallChecks(): void {
  report = null;
}

export async function checkPrecache(): Promise<boolean> {
  return (await offlineReport()).precached;
}

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
  available: boolean;
  persisted: boolean;
}

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
