import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';
import { useSyncStatus } from '@/sync/useSyncStatus';

/** True when the browser says it is offline or the last sync run could not reach the server. */
export function useOffline(): boolean {
  const { status } = useSyncStatus();
  const online = useOnlineStatus();
  return !online || status === 'offline';
}
