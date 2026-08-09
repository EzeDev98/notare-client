import { describe, expect, it } from 'vitest';

import { authReducer, initialAuthState, type AuthAction } from '@/features/auth/authMachine';
import type { AuthState, CurrentUser } from '@/features/auth/types';

const user: CurrentUser = {
  id: 42,
  notarianId: 'ABCDEFG',
  username: 'testuser',
  firstName: 'Test',
  lastName: 'User',
  email: 'test@example.com',
  gender: 'MALE',
  createdAt: '2026-01-01T09:00:00.000',
};

const authenticated: AuthState = { status: 'authenticated', user };

describe('startup', () => {
  it('starts in initializing, not unauthenticated', () => {
    // Collapsing the two flashes the login screen on every reload, before the
    // stored session has been read.
    expect(initialAuthState).toEqual({ status: 'initializing' });
  });

  it('settles to unauthenticated when there is no stored session', () => {
    expect(authReducer(initialAuthState, { type: 'INIT_NO_SESSION' })).toEqual({
      status: 'unauthenticated',
    });
  });

  it('settles to authenticated when a session is restored', () => {
    expect(authReducer(initialAuthState, { type: 'INIT_RESTORED', user })).toEqual(authenticated);
  });
});

describe('login', () => {
  it('reports a failed login as unauthenticated, not session-expired', () => {
    const state = authReducer({ status: 'authenticating' }, { type: 'LOGIN_FAILED' });

    // Bad credentials are not an expired session. The two screens say
    // different things: try again, versus something ended.
    expect(state).toEqual({ status: 'unauthenticated' });
  });
});

describe('refresh', () => {
  it('carries the user through refreshing, so the UI does not flicker', () => {
    const state = authReducer(authenticated, { type: 'REFRESH_STARTED' });

    // `refreshing` renders identically to `authenticated`. Dropping the user
    // here would blank the app for the duration of a background request.
    expect(state).toEqual({ status: 'refreshing', user });
  });

  it('treats a failed refresh as terminal', () => {
    const state = authReducer({ status: 'refreshing', user }, { type: 'REFRESH_FAILED' });

    /*
     * The transition the whole design turns on. The server deletes the session
     * record on a token mismatch, so there is nothing left to refresh against.
     * session-expired rather than unauthenticated, because unsaved work must
     * survive and the user needs an explanation.
     */
    expect(state).toEqual({ status: 'session-expired', reason: 'refresh-failed' });
  });

  it('ignores REFRESH_STARTED when there is no session', () => {
    // A late-arriving action after logout is a benign race, not a crash.
    const unauthenticated: AuthState = { status: 'unauthenticated' };
    expect(authReducer(unauthenticated, { type: 'REFRESH_STARTED' })).toBe(unauthenticated);
  });

  it('ignores REFRESH_SUCCEEDED arriving after a logout', () => {
    /*
     * The real sequence: a refresh is in flight, the user signs out, the
     * refresh resolves. Without this guard the app would silently sign them
     * back in.
     */
    const unauthenticated: AuthState = { status: 'unauthenticated' };
    expect(authReducer(unauthenticated, { type: 'REFRESH_SUCCEEDED' })).toBe(unauthenticated);
  });
});

describe('ending a session', () => {
  it('distinguishes signing out from being revoked', () => {
    expect(authReducer(authenticated, { type: 'LOGGED_OUT' })).toEqual({
      status: 'unauthenticated',
    });

    expect(authReducer(authenticated, { type: 'SESSION_REVOKED' })).toEqual({
      status: 'session-expired',
      reason: 'revoked',
    });
  });
});

describe('totality', () => {
  it('returns a state for every action from every state', () => {
    const states: AuthState[] = [
      { status: 'initializing' },
      { status: 'unauthenticated' },
      { status: 'authenticating' },
      authenticated,
      { status: 'refreshing', user },
      { status: 'session-expired', reason: 'refresh-failed' },
    ];

    const actions: AuthAction[] = [
      { type: 'INIT_NO_SESSION' },
      { type: 'INIT_RESTORED', user },
      { type: 'LOGIN_STARTED' },
      { type: 'LOGIN_SUCCEEDED', user },
      { type: 'LOGIN_FAILED' },
      { type: 'REFRESH_STARTED' },
      { type: 'REFRESH_SUCCEEDED' },
      { type: 'REFRESH_FAILED' },
      { type: 'LOGGED_OUT' },
      { type: 'SESSION_REVOKED' },
    ];

    // 60 combinations, none of which may throw. A reducer that throws on an
    // "impossible" transition turns a race into a crash.
    for (const state of states) {
      for (const action of actions) {
        expect(() => authReducer(state, action)).not.toThrow();
      }
    }
  });
});
