/** The sync engine's status. */
export type SyncStatusValue = 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncStatus {
  status: SyncStatusValue;
  lastSyncedAt: number | null;
  lastError: string | null;
  failures: number;
}

export const SYNC_PAUSED_AFTER_FAILURES = 2;

export function isSyncPaused(status: SyncStatus): boolean {
  return status.failures >= SYNC_PAUSED_AFTER_FAILURES;
}

const listeners = new Set<() => void>();

let current: SyncStatus = { status: 'idle', lastSyncedAt: null, lastError: null, failures: 0 };

export function getSyncStatus(): SyncStatus {
  return current;
}

export function subscribeSyncStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setSyncStatus(patch: Partial<SyncStatus>): void {
  current = { ...current, ...patch };
  listeners.forEach((listener) => {
    listener();
  });
}

export function resetSyncStatusForTests(): void {
  current = { status: 'idle', lastSyncedAt: null, lastError: null, failures: 0 };
  listeners.clear();
}
