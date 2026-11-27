import { useAuth } from '@/app/providers/auth-context';
import { useSessionUser } from '@/app/shell/useSessionUser';
import { useSync } from '@/sync/useSync';

/**
 * Starts the sync engine for the signed-in owner and stops it when the shell
 * unmounts (sign out). This is the one job the old AppLayout did that has nothing to do with layout.
 */
export function useStartSync(): void {
  const user = useSessionUser();
  const { state } = useAuth();
  const paused = state.status === 'session-expired';
  useSync(user?.id ?? null, paused);
}
