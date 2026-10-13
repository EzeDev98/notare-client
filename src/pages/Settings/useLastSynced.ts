import { useEffect, useState } from 'react';

import { LAST_SYNCED_REFRESH_MS } from '@/core/config/timings';
import { useSyncStatus } from '@/sync/useSyncStatus';

import { ago } from './ago';
import { SETTINGS_COPY } from './settingsContent';

/** "Just now", "12 min ago", "3 h ago": when the sync engine last finished a clean run. */
export function useLastSynced(): string {
  const { lastSyncedAt } = useSyncStatus();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
    }, LAST_SYNCED_REFRESH_MS);
    return () => {
      clearInterval(id);
    };
  }, []);

  return lastSyncedAt === null ? SETTINGS_COPY.syncStorage.lastSyncedNever : ago(lastSyncedAt, now);
}
