import { sessionUserOf } from '@/features/auth/sessionUser';
import type { AuthState, CurrentUser } from '@/features/auth/types';

/**
 * The auth state machine, as a pure reducer. No React, no network, no storage.
 *
 * Separated so the TRANSITIONS can be tested exhaustively without rendering
 * anything or mocking a server — the interesting failures here are ordering
 * problems, and those are far easier to provoke by dispatching actions in a
 * deliberate sequence than by driving a UI.
 */

export type AuthAction =
  /** Startup found no stored session. */
  | { type: 'INIT_NO_SESSION' }
  /** Startup restored one. */
  | { type: 'INIT_RESTORED'; user: CurrentUser }
  | { type: 'LOGIN_STARTED' }
  | { type: 'LOGIN_SUCCEEDED'; user: CurrentUser }
  | { type: 'LOGIN_FAILED' }
  | { type: 'REFRESH_STARTED' }
  | { type: 'REFRESH_SUCCEEDED' }
  /** Terminal. The server deleted the session record; nothing can retry. */
  | { type: 'REFRESH_FAILED' }
  /** The user asked to sign out. */
  | { type: 'LOGGED_OUT' }
  /** Somebody else ended this session — revoked from another device. */
  | { type: 'SESSION_REVOKED' };

export const initialAuthState: AuthState = { status: 'initializing' };

/**
 * TOTAL: every (state, action) pair produces a state, including nonsensical
 * ones like REFRESH_STARTED while unauthenticated.
 *
 * Those return the CURRENT state rather than throwing. A late-arriving action
 * after logout is a benign race — an in-flight refresh resolving just after
 * the user signed out — and throwing would turn it into a crash. Ignoring an
 * impossible transition is the correct behaviour, not a missing case.
 */
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
      /*
       * unauthenticated, NOT session-expired. Bad credentials are not an
       * expired session, and the two screens say different things — one asks
       * you to try again, the other explains that something ended.
       */
      return { status: 'unauthenticated' };

    case 'REFRESH_STARTED':
      /*
       * Only meaningful while authenticated, and the user must be carried
       * across so the UI does not flicker: `refreshing` renders identically to
       * `authenticated`, and dropping the user here would blank the app for
       * the duration of a background request.
       */
      return state.status === 'authenticated' ? { status: 'refreshing', user: state.user } : state;

    case 'REFRESH_SUCCEEDED':
      return state.status === 'refreshing' ? { status: 'authenticated', user: state.user } : state;

    case 'REFRESH_FAILED':
      /*
       * TERMINAL, and this is the transition the whole design turns on. The
       * server deletes the session record on a token mismatch, so there is
       * nothing left to refresh against and no retry that helps.
       *
       * session-expired rather than unauthenticated because unsaved local work
       * must survive: someone who signed out expects to lose nothing, someone
       * whose refresh failed mid-sentence expects their sentence to still be
       * there.
       */
      return { status: 'session-expired', reason: 'refresh-failed', user: sessionUserOf(state) };

    case 'LOGGED_OUT':
      return { status: 'unauthenticated' };

    case 'SESSION_REVOKED':
      return { status: 'session-expired', reason: 'revoked', user: sessionUserOf(state) };

    default: {
      // Add an action and forget it here, and this stops compiling.
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
