/** The sync engine's status as a React hook. */
import { useSyncExternalStore } from 'react';

import { getSyncStatus, subscribeSyncStatus, type SyncStatus } from '@/sync/syncStatus';

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribeSyncStatus, getSyncStatus, getSyncStatus);
}
