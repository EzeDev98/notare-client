/** The signed-in person, or null. */
import { sessionUserOf } from '@/features/auth/sessionUser';
import { useAuth } from '@/app/providers/auth-context';
import type { CurrentUser } from '@/features/auth/types';

export function useSessionUser(): CurrentUser | null {
  const { state } = useAuth();
  return sessionUserOf(state);
}
