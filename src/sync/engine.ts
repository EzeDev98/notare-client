import { purgeExpiredTrash } from '@/features/notes/local/housekeeping';
import { uploadPendingClips } from '@/sync/clipUpload';
import { releaseLegacyConflicts } from '@/sync/releaseLegacyConflicts';
import { pullChanges } from '@/sync/pull';
import { pushOutbox } from '@/sync/push';
import { onLocalMutation } from '@/sync/mutationSignal';
import { setSyncStatus } from '@/sync/syncStatus';
import { consumeTransportFailure } from '@/sync/transportFailure';
import { SYNC_AFTER_CHANGE_MS, SYNC_BACKOFF_MS } from '@/core/config/timings';

/**
 * The sync engine (8F): everything push.ts (8C) and pull.ts (8D) deliberately
 * left unscheduled — "WHEN this runs is not this function's concern," their
 * own doc comments say, naming this file as the place that concern lives.
 *
 * TRIGGERS (architecture doc §3.8, step 8f): app start, the browser's `online`
 * event, the tab becoming visible, and a debounced local mutation
 * (SYNC_AFTER_CHANGE_MS after the last change). There is no polling interval:
 * sync is event-driven, and this file is the only scheduler (A-05).
 *
 * CROSS-TAB LOCK: `notare.sync`, same `navigator.locks` mechanism and the
 * same graceful same-tab-only fallback as `notare.auth.refresh` (4D,
 * `refreshCoordinator.ts`) for browsers without Web Locks. One real
 * difference from that lock: a refresh that loses the race must WAIT its
 * turn — nobody can proceed without a token. A sync run that loses the race
 * SKIPS instead (`{ ifAvailable: true }`) — another tab is doing the exact
 * same work right now, and queuing up behind it has nothing to contribute.
 *
 * BACKOFF: only engages after a TRANSPORT failure (see transportFailure.ts)
 * — a genuine "the server is unreachable right now" signal, not the routine
 * "nothing was queued" no-op every empty push/pull already returns instantly
 * from. The schedule (SYNC_BACKOFF_MS) is capped at its last step.
 */

const LOCK_NAME = 'notare.sync';

let fallbackChain: Promise<unknown> = Promise.resolve();

function withSyncLock<T>(critical: () => Promise<T>): Promise<T | 'skipped'> {
  if (typeof navigator !== 'undefined' && 'locks' in navigator) {
    return navigator.locks.request(LOCK_NAME, { ifAvailable: true }, (lock) =>
      lock ? critical() : Promise.resolve('skipped' as const),
    );
  }

  const result = fallbackChain.then(critical);
  // Swallowed here, same reasoning as refreshCoordinator.ts: one failed run
  // must not poison the chain for every run after it.
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

/**
 * One sync attempt: push then pull, sequenced (never `Promise.all` — push
 * before pull is load-bearing, architecture doc §3.8), inside the cross-tab
 * lock.
 *
 * Returns whether the attempt completed WITHOUT a transport failure.
 */
async function attempt(): Promise<boolean> {
  consumeTransportFailure(); // discard anything stale from an earlier, unrelated run
  await pushOutbox();
  // Clips go after notes, so a note made offline has its server id by now (step 8j).
  await uploadPendingClips();
  await pullChanges(ownerIdRef);
  return !consumeTransportFailure();
}

async function run(): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    // Cheap and worth checking first — no point acquiring the lock or making
    // a request `navigator.onLine` already told us will fail. Still only a
    // HINT (useOnlineStatus.ts's own doc comment: it can tell you offline
    // reliably, not online) — the transport-failure path below is what
    // catches the case where this said true and a request failed anyway.
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
    /*
     * NOT a transport failure — push.ts/pull.ts already convert those to a
     * clean return via isOffline, and this catch only sees what THEY chose
     * to rethrow: a genuine bug, or a server response neither recognises.
     * That deserves a visible 'error' status and a log, not a silent retry
     * loop pretending everything is fine.
     */
    setSyncStatus({
      status: 'error',
      lastError: error instanceof Error ? error.message : 'Sync failed',
    });
    console.error('[sync] run failed', error);
    scheduleBackoffRetry();
    return;
  }

  if (outcome === 'skipped') {
    // Another tab holds the lock and is doing this exact work right now.
    // Nothing happened on THIS tab, so there is nothing to report and
    // nothing to back off from.
    return;
  }

  if (outcome === 'transport-failure') {
    setSyncStatus({ status: 'offline' });
    scheduleBackoffRetry();
    return;
  }

  backoffStep = 0;
  clearBackoffTimer();
  setSyncStatus({ status: 'idle', lastSyncedAt: Date.now(), lastError: null });
}

/**
 * Requests a sync run. Coalesces with any run already in flight — identical
 * reentrancy discipline to `pushOutbox`/`pullChanges`, and for the same
 * reason: a second call arriving mid-run has nothing new to contribute until
 * the first one finishes.
 *
 * `reason` is a diagnostic label only (visible in the console on failure),
 * never a priority or a queueing key — every trigger asking at once still
 * produces exactly one run.
 */
export function requestSync(reason: string): Promise<void> {
  if (ownerIdRef === null) return Promise.resolve();
  console.debug('[sync] run requested', reason);
  inFlight ??= run().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/**
 * Starts the engine's triggers for one signed-in owner. Returns a function
 * that stops them.
 *
 * A normal effect from the caller's side (`useSync`): call on mount and
 * whenever `ownerId` changes, call the returned function on cleanup. `stop`
 * is also what makes logout inert — the returned function removes every
 * listener and clears every timer, so nothing left running tries to sync
 * with no session behind it.
 */
export function start(ownerId: number | null): () => void {
  ownerIdRef = ownerId;
  backoffStep = 0;
  clearBackoffTimer();

  window.addEventListener('online', handleOnline);
  document.addEventListener('visibilitychange', handleVisibility);
  unsubscribeMutation = onLocalMutation(handleMutation);

  void requestSync('start');
  void releaseLegacyConflicts().catch(() => undefined);
  // Once per start: remove deleted notes whose purge date has passed (step 8i).
  void purgeExpiredTrash().catch(() => undefined);

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

/** Test-only: every piece of this module's state, back to its resting position. */
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
