/** Starts sync for the signed-in person and stops it on sign out. */
import { useAuth } from '@/app/providers/auth-context';
import { useSessionUser } from '@/app/shell/useSessionUser';
import { useSync } from '@/sync/useSync';

export function useStartSync(): void {
  const user = useSessionUser();
  const { state } = useAuth();
  const paused = state.status === 'session-expired';
  useSync(user?.id ?? null, paused);
}
