/** When sync last finished a clean run. */
import { useEffect, useState } from 'react';

import { LAST_SYNCED_REFRESH_MS } from '@/core/config/timings';
import { useSyncState } from '@/features/notes/hooks/useSyncState';

import { ago } from './ago';
import { SETTINGS_COPY } from './settingsContent';

export function useLastSynced(): string {
  const { lastSyncedAt } = useSyncState();
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
