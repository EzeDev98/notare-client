import { useEffect, useRef } from 'react';

import { useToast } from '@/design-system/ui';
import { useOffline } from '@/features/notes/hooks/useOffline';
import { OFFLINE_COPY } from '@/features/notes/list/offlineContent';

import { useDrawerCounts } from './useDrawerCounts';
import { useSessionUser } from './useSessionUser';

/**
 * Says "Back online. N notes synced." once, when the device comes back. N is the
 * most notes that were waiting while it was offline. Renders nothing.
 */
function Watcher({ userId }: { userId: number }) {
  const offline = useOffline();
  const { waiting } = useDrawerCounts(userId);
  const { toast } = useToast();
  const wasOffline = useRef(offline);
  const peak = useRef(0);

  useEffect(() => {
    if (offline) {
      peak.current = Math.max(peak.current, waiting);
    } else if (wasOffline.current) {
      toast(
        peak.current > 0 ? OFFLINE_COPY.backOnlineSynced(peak.current) : OFFLINE_COPY.backOnline,
        { tone: 'success' },
      );
      peak.current = 0;
    }
    wasOffline.current = offline;
  }, [offline, waiting, toast]);

  return null;
}

export function BackOnlineToast() {
  const user = useSessionUser();
  return user ? <Watcher userId={user.id} /> : null;
}
