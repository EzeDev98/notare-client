/** Whether the app is offline. */
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';
import { useSyncStatus } from '@/sync/useSyncStatus';

export function useOffline(): boolean {
  const { status } = useSyncStatus();
  const online = useOnlineStatus();
  return !online || status === 'offline';
}
