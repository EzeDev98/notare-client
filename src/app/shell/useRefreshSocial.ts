import { useEffect } from 'react';

import { refreshPeople } from '@/features/collaboration/refreshPeople';
import { useOffline } from '@/features/notes/hooks/useOffline';
import { refreshShared } from '@/features/sharedNotes/refreshShared';

/** Refreshes People and Shared with me at sign-in and whenever the device comes back online. */
export function useRefreshSocial(userId: number | null): void {
  const offline = useOffline();

  useEffect(() => {
    if (userId === null || offline) return;
    void Promise.allSettled([refreshPeople(), refreshShared()]);
  }, [userId, offline]);
}
