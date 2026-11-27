/** The sync engine: decides when to push and pull. */
import { uploadPendingClips } from '@/sync/clipUpload';
import { releaseLegacyConflicts } from '@/sync/releaseLegacyConflicts';
import { pullChanges } from '@/sync/pull';
import { pushOutbox } from '@/sync/push';
import { onLocalMutation } from '@/sync/mutationSignal';
import { getSyncStatus, setSyncStatus } from '@/sync/syncStatus';
import { consumeTransportFailure } from '@/sync/transportFailure';
import { SYNC_AFTER_CHANGE_MS, SYNC_BACKOFF_MS } from '@/core/config/timings';

const LOCK_NAME = 'notare.sync';

let fallbackChain: Promise<unknown> = Promise.resolve();

function withSyncLock<T>(critical: () => Promise<T>): Promise<T | 'skipped'> {
  if (typeof navigator !== 'undefined' && 'locks' in navigator) {
    return navigator.locks.request(LOCK_NAME, { ifAvailable: true }, (lock) =>
      lock ? critical() : Promise.resolve('skipped' as const),
    );
  }

  const result = fallbackChain.then(critical);
  fallbackChain = result.catch(() => undefined);
  return result;
}

let ownerIdRef: number | null = null;
let inFlight: Promise<void> | null = null;
let backoffStep = 0;
let backoffTimer: ReturnType<typeof setTimeout> | null = null;
let mutationDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribeMutation: (() => void) | null = null;

function clearBackoffTimer(): void {
  if (backoffTimer !== null) {
    clearTimeout(backoffTimer);
    backoffTimer = null;
  }
}

function scheduleBackoffRetry(): void {
  clearBackoffTimer();
  const delay = SYNC_BACKOFF_MS[Math.min(backoffStep, SYNC_BACKOFF_MS.length - 1)]!;
  backoffStep += 1;
  backoffTimer = setTimeout(() => {
    backoffTimer = null;
    void requestSync('backoff');
  }, delay);
}

function handleOnline(): void {
  void requestSync('online');
}

function handleMutation(): void {
  if (mutationDebounceTimer !== null) clearTimeout(mutationDebounceTimer);
  mutationDebounceTimer = setTimeout(() => {
    mutationDebounceTimer = null;
    void requestSync('mutation');
  }, SYNC_AFTER_CHANGE_MS);
}

function handleVisibility(): void {
  if (document.visibilityState === 'visible') {
    void requestSync('visible');
  }
}

async function attempt(): Promise<boolean> {
  consumeTransportFailure();
  await pushOutbox();
  await uploadPendingClips();
  await pullChanges(ownerIdRef);
  return !consumeTransportFailure();
}

async function run(): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    setSyncStatus({ status: 'offline' });
    scheduleBackoffRetry();
    return;
  }

  setSyncStatus({ status: 'syncing' });

  let outcome: 'clean' | 'transport-failure' | 'skipped';
  try {
    const result = await withSyncLock(attempt);
    outcome = result === 'skipped' ? 'skipped' : result ? 'clean' : 'transport-failure';
  } catch (error) {
    setSyncStatus({
      status: 'error',
      lastError: error instanceof Error ? error.message : 'Sync failed',
      failures: getSyncStatus().failures + 1,
    });
    console.error('[sync] run failed', error);
    scheduleBackoffRetry();
    return;
  }

  if (outcome === 'skipped') {
    return;
  }

  if (outcome === 'transport-failure') {
    setSyncStatus({ status: 'offline', failures: getSyncStatus().failures + 1 });
    scheduleBackoffRetry();
    return;
  }

  backoffStep = 0;
  clearBackoffTimer();
  setSyncStatus({ status: 'idle', lastSyncedAt: Date.now(), lastError: null, failures: 0 });
}

export function requestSync(reason: string): Promise<void> {
  if (ownerIdRef === null) return Promise.resolve();
  console.debug('[sync] run requested', reason);
  inFlight ??= run().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export function start(ownerId: number | null): () => void {
  ownerIdRef = ownerId;
  backoffStep = 0;
  clearBackoffTimer();

  window.addEventListener('online', handleOnline);
  document.addEventListener('visibilitychange', handleVisibility);
  unsubscribeMutation = onLocalMutation(handleMutation);

  void requestSync('start');
  void releaseLegacyConflicts().catch(() => undefined);

  return function stop(): void {
    window.removeEventListener('online', handleOnline);
    document.removeEventListener('visibilitychange', handleVisibility);
    unsubscribeMutation?.();
    unsubscribeMutation = null;
    clearBackoffTimer();
    if (mutationDebounceTimer !== null) {
      clearTimeout(mutationDebounceTimer);
      mutationDebounceTimer = null;
    }
    ownerIdRef = null;
  };
}

export function resetSyncEngineForTests(): void {
  window.removeEventListener('online', handleOnline);
  document.removeEventListener('visibilitychange', handleVisibility);
  unsubscribeMutation?.();
  unsubscribeMutation = null;
  ownerIdRef = null;
  inFlight = null;
  backoffStep = 0;
  clearBackoffTimer();
  if (mutationDebounceTimer !== null) {
    clearTimeout(mutationDebounceTimer);
    mutationDebounceTimer = null;
  }
  fallbackChain = Promise.resolve();
}
