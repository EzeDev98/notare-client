import { useDrawerCounts, type DrawerCounts } from '@/app/shell/useDrawerCounts';
import { useOffline } from '@/features/notes/hooks/useOffline';
import { isSyncPaused } from '@/sync/syncStatus';
import { useSyncStatus } from '@/sync/useSyncStatus';

import { SETTINGS_COPY } from './settingsContent';

/**
 * The device's one sync answer in words, and the live counts behind it. Offline
 * wins, then a paused engine, then anything waiting, and only an empty queue
 * reads "Synced". This page is the only place sync results are shown.
 */
export function useSyncSummary(ownerId: number): { word: string; counts: DrawerCounts } {
  const counts = useDrawerCounts(ownerId);
  const offline = useOffline();
  const sync = useSyncStatus();
  const copy = SETTINGS_COPY.sync;
  const word = offline
    ? copy.offline
    : isSyncPaused(sync)
      ? copy.paused
      : counts.waiting > 0
        ? copy.waiting(counts.waiting)
        : copy.online;
  return { word, counts };
}
