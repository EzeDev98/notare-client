import { useAuth } from '@/app/providers/auth-context';
import type { CurrentUser } from '@/features/auth/types';

/**
 * The signed-in person, or null when there is no session. A token refresh
 * counts as signed in: it must not blank the shell.
 */
export function useSessionUser(): CurrentUser | null {
  const { state } = useAuth();
  return state.status === 'authenticated' || state.status === 'refreshing' ? state.user : null;
}
