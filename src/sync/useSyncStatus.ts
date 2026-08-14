import { useSyncExternalStore } from 'react';

import { getSyncStatus, subscribeSyncStatus, type SyncStatus } from '@/sync/syncStatus';

/**
 * The one file allowed to know `useSyncExternalStore` exists for this
 * subsystem — same division of labour `useLiveQuery` draws for Dexie (Step
 * 7's own callout: "what useSyncExternalStore does underneath useLiveQuery"
 * is exactly what this does explicitly, since `syncStatus.ts` is a plain
 * store, not a Dexie table).
 *
 * Same snapshot for the client and the (unused, no SSR here) server
 * argument — `getSyncStatus` already returns a stable reference until
 * `setSyncStatus` replaces it, so there is nothing server-specific to add.
 */
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribeSyncStatus, getSyncStatus, getSyncStatus);
}
