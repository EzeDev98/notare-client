import { pullChanges } from '@/sync/pull';
import { pushOutbox } from '@/sync/push';
import { onLocalMutation } from '@/sync/mutationSignal';
import { setSyncStatus } from '@/sync/syncStatus';
import { consumeTransportFailure } from '@/sync/transportFailure';

/**
 * The sync engine (8F): everything push.ts (8C) and pull.ts (8D) deliberately
 * left unscheduled — "WHEN this runs is not this function's concern," their
 * own doc comments say, naming this file as the place that concern lives.
 *
 * TRIGGERS (architecture doc §3.8): app start, the browser's `online` event,
 * the tab becoming visible, a debounced local mutation, and a slow ~60s
 * interval while online and visible. Never a bare `setInterval` running in a
 * backgrounded tab forever — the interval is created on `visible` and
 * cleared on every other visibility state, not just left running.
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
 * from. Schedule is capped at the same 60s the steady-state interval already
 * uses, so a backing-off run is never waiting longer than normal operation
 * already would.
 */

const LOCK_NAME = 'notare.sync';
const SLOW_INTERVAL_MS = 60_000;
const MUTATION_DEBOUNCE_MS = 2_000;
const BACKOFF_SCHEDULE_MS = [5_000, 15_000, 30_000, SLOW_INTERVAL_MS];

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
let intervalTimer: ReturnType<typeof setInterval> | null = null;
let unsubscribeMutation: (() => void) | null = null;

function clearBackoffTimer(): void {
  if (backoffTimer !== null) {
    clearTimeout(backoffTimer);
    backoffTimer = null;
  }
}

function scheduleBackoffRetry(): void {
  clearBackoffTimer();
  const delay = BACKOFF_SCHEDULE_MS[Math.min(backoffStep, BACKOFF_SCHEDULE_MS.length - 1)]!;
  backoffStep += 1;
  backoffTimer = setTimeout(() => {
    backoffTimer = null;
    void requestSync('backoff');
  }, delay);
}

function stopInterval(): void {
  if (intervalTimer !== null) {
    clearInterval(intervalTimer);
    intervalTimer = null;
  }
}

function startInterval(): void {
  if (intervalTimer !== null) return;
  intervalTimer = setInterval(() => {
    void requestSync('interval');
  }, SLOW_INTERVAL_MS);
}

function handleOnline(): void {
  void requestSync('online');
}

function handleMutation(): void {
  if (mutationDebounceTimer !== null) clearTimeout(mutationDebounceTimer);
  mutationDebounceTimer = setTimeout(() => {
    mutationDebounceTimer = null;
    void requestSync('mutation');
  }, MUTATION_DEBOUNCE_MS);
}

function handleVisibility(): void {
  if (document.visibilityState === 'visible') {
    startInterval();
    void requestSync('visible');
  } else {
    // The anti-pattern named in the architecture doc: a `setInterval` that
    // keeps firing in a tab nobody is looking at. Cleared here, recreated by
    // `startInterval` the moment the tab is visible again.
    stopInterval();
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

  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    startInterval();
  }

  void requestSync('start');

  return function stop(): void {
    window.removeEventListener('online', handleOnline);
    document.removeEventListener('visibilitychange', handleVisibility);
    unsubscribeMutation?.();
    unsubscribeMutation = null;
    stopInterval();
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
  stopInterval();
  if (mutationDebounceTimer !== null) {
    clearTimeout(mutationDebounceTimer);
    mutationDebounceTimer = null;
  }
  fallbackChain = Promise.resolve();
}
