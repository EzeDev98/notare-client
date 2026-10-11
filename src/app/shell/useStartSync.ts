import { useRefreshSocial } from '@/app/shell/useRefreshSocial';
import { useSessionUser } from '@/app/shell/useSessionUser';
import { useSync } from '@/sync/useSync';

/**
 * Starts the sync engine for the signed-in owner and stops it when the shell
 * unmounts (sign out), and keeps People and Shared with me fresh. This is the
 * one job the old AppLayout did that has nothing to do with layout.
 */
export function useStartSync(): void {
  const user = useSessionUser();
  useSync(user?.id ?? null);
  useRefreshSocial(user?.id ?? null);
}
