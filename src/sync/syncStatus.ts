/**
 * The sync engine's status, and nothing else — 8F's "sync status surface"
 * (architecture doc §3.8's `.status$`).
 *
 * Framework-free by the same rule as `push.ts`/`pull.ts`: this subsystem has
 * no knowledge of React. `useSyncStatus.ts` is the one file allowed to know
 * `useSyncExternalStore` exists; everything on this side of that line is a
 * plain subscribe/get/set triple any consumer — React or otherwise — could
 * use.
 */

export type SyncStatusValue = 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncStatus {
  status: SyncStatusValue;
  /** Epoch ms of the last run that completed with no transport failure. */
  lastSyncedAt: number | null;
  /** Set on 'error', cleared on the next clean run. */
  lastError: string | null;
}

const listeners = new Set<() => void>();

let current: SyncStatus = { status: 'idle', lastSyncedAt: null, lastError: null };

export function getSyncStatus(): SyncStatus {
  return current;
}

export function subscribeSyncStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * `engine.ts`'s only way to change this. A partial patch, not a full
 * replacement — `run()` sets one or two fields at a time (e.g. `{ status:
 * 'syncing' }`) and has no reason to know or repeat the rest.
 */
export function setSyncStatus(patch: Partial<SyncStatus>): void {
  current = { ...current, ...patch };
  listeners.forEach((listener) => {
    listener();
  });
}

/** Test-only: back to the resting state, with no listeners left attached. */
export function resetSyncStatusForTests(): void {
  current = { status: 'idle', lastSyncedAt: null, lastError: null };
  listeners.clear();
}
