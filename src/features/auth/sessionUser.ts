import type { AuthState, CurrentUser } from '@/features/auth/types';

/**
 * The person this device belongs to, or null when nobody is signed in.
 *
 * A session that ended without the person asking for it (session-expired) still
 * counts: their notes are on this device and must stay on screen while they sign
 * in again (step 14a). Only an explicit sign out, or a start-up with no session,
 * returns null.
 */
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
