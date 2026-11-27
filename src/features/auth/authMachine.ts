/** The auth state machine. */
import { sessionUserOf } from '@/features/auth/sessionUser';
import type { AuthState, CurrentUser } from '@/features/auth/types';

export type AuthAction =
  | { type: 'INIT_NO_SESSION' }
  | { type: 'INIT_RESTORED'; user: CurrentUser }
  | { type: 'LOGIN_STARTED' }
  | { type: 'LOGIN_SUCCEEDED'; user: CurrentUser }
  | { type: 'LOGIN_FAILED' }
  | { type: 'REFRESH_STARTED' }
  | { type: 'REFRESH_SUCCEEDED' }
  | { type: 'REFRESH_FAILED' }
  | { type: 'LOGGED_OUT' }
  | { type: 'SESSION_REVOKED' };

export const initialAuthState: AuthState = { status: 'initializing' };

export function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'INIT_NO_SESSION':
      return { status: 'unauthenticated' };

    case 'INIT_RESTORED':
      return { status: 'authenticated', user: action.user };

    case 'LOGIN_STARTED':
      return { status: 'authenticating' };

    case 'LOGIN_SUCCEEDED':
      return { status: 'authenticated', user: action.user };

    case 'LOGIN_FAILED':
      return { status: 'unauthenticated' };

    case 'REFRESH_STARTED':
      return state.status === 'authenticated' ? { status: 'refreshing', user: state.user } : state;

    case 'REFRESH_SUCCEEDED':
      return state.status === 'refreshing' ? { status: 'authenticated', user: state.user } : state;

    case 'REFRESH_FAILED':
      return { status: 'session-expired', reason: 'refresh-failed', user: sessionUserOf(state) };

    case 'LOGGED_OUT':
      return { status: 'unauthenticated' };

    case 'SESSION_REVOKED':
      return { status: 'session-expired', reason: 'revoked', user: sessionUserOf(state) };

    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
