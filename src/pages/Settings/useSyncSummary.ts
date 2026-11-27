/** The device's sync state in words, with its counts. */
import { useDrawerCounts, type DrawerCounts } from '@/app/shell/useDrawerCounts';
import { useOffline } from '@/features/notes/hooks/useOffline';
import { useSyncState } from '@/features/notes/hooks/useSyncState';

import { SETTINGS_COPY } from './settingsContent';

export function useSyncSummary(ownerId: number): { word: string; counts: DrawerCounts } {
  const counts = useDrawerCounts(ownerId);
  const offline = useOffline();
  const { paused } = useSyncState();
  const copy = SETTINGS_COPY.sync;
  const word = offline
    ? copy.offline
    : paused
      ? copy.paused
      : counts.waiting > 0
        ? copy.waiting(counts.waiting)
        : copy.online;
  return { word, counts };
}
