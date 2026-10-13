import { useDrawerCounts, type DrawerCounts } from '@/app/shell/useDrawerCounts';
import { useOffline } from '@/features/notes/hooks/useOffline';

import { SETTINGS_COPY } from './settingsContent';

/**
 * The device's one sync answer in words, and the live counts behind it. Offline
 * wins, then anything waiting, and only an empty queue reads "Synced".
 */
export function useSyncSummary(ownerId: number): { word: string; counts: DrawerCounts } {
  const counts = useDrawerCounts(ownerId);
  const offline = useOffline();
  const copy = SETTINGS_COPY.sync;
  const word = offline ? copy.offline : counts.waiting > 0 ? copy.waiting(counts.waiting) : copy.online;
  return { word, counts };
}
