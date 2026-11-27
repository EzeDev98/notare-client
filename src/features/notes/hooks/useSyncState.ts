/** Sync status for screens, and a manual sync. */
import { SYNC_NOW_MIN_BUSY_MS } from '@/core/config/timings';
import { wait } from '@/lib/wait';
import { requestSync } from '@/sync/engine';
import { getSyncStatus, isSyncPaused } from '@/sync/syncStatus';
import { useSyncStatus } from '@/sync/useSyncStatus';

export function useSyncState(): { lastSyncedAt: number | null; paused: boolean } {
  const sync = useSyncStatus();
  return { lastSyncedAt: sync.lastSyncedAt, paused: isSyncPaused(sync) };
}

export async function syncNow(): Promise<boolean> {
  await Promise.all([requestSync('manual').catch(() => undefined), wait(SYNC_NOW_MIN_BUSY_MS)]);
  const { status } = getSyncStatus();
  return status !== 'offline' && status !== 'error';
}
