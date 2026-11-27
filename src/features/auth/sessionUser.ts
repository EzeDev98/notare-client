/** The person this device belongs to. */
import type { AuthState, CurrentUser } from '@/features/auth/types';

export function sessionUserOf(state: AuthState): CurrentUser | null {
  switch (state.status) {
    case 'authenticated':
    case 'refreshing':
    case 'session-expired':
      return state.user;
    default:
      return null;
  }
}
