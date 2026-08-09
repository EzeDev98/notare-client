import { useCallback, useEffect, useReducer, type ReactNode } from 'react';

import { AuthContext } from '@/app/providers/auth-context';
import { authService } from '@/features/auth/api/authService';
import { authReducer, initialAuthState } from '@/features/auth/authMachine';
import { installAuthHooks } from '@/features/auth/httpAuth';
import {
  ensureFreshAccessToken,
  subscribeToTokenBroadcasts,
} from '@/features/auth/refreshCoordinator';
import { clearSession, setAccessToken, setStoredRefreshToken } from '@/features/auth/tokenStore';
import type { LoginRequest } from '@/features/auth/types';

/**
 * Owns the session. Thin on purpose — the transitions live in authMachine and
 * the concurrency lives in refreshCoordinator, both testable without React.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialAuthState);

  /*
   * STARTUP RESTORE.
   *
   * The access token is memory-only, so after a reload the only credential we
   * hold is the refresh token — restoring a session IS a refresh. That is also
   * why this goes through the coordinator's lock rather than calling the
   * service directly: startup is exactly when several tabs are most likely to
   * restore at the same moment.
   *
   * A genuine effect: synchronising React state with persisted state outside
   * the tree. Runs once — the empty dependency array is correct here, not a
   * lint workaround.
   */
  useEffect(() => {
    let cancelled = false;

    async function restore(): Promise<void> {
      try {
        const hasSession = await ensureFreshAccessToken();
        if (cancelled) return;

        if (!hasSession) {
          dispatch({ type: 'INIT_NO_SESSION' });
          return;
        }

        // Only now can we ask who we are — /user/me needs a valid access token.
        const user = await authService.getCurrentUser();
        if (cancelled) return;

        dispatch({ type: 'INIT_RESTORED', user });
      } catch {
        if (cancelled) return;
        /*
         * INIT_NO_SESSION, not REFRESH_FAILED. A failure during startup means
         * the stored session was unusable — the user has not been interrupted
         * mid-anything, so showing "your session expired" would be alarming
         * language for what is, from their side, an ordinary sign-in.
         */
        dispatch({ type: 'INIT_NO_SESSION' });
      }
    }

    void restore();

    return () => {
      cancelled = true;
    };
  }, []);

  /* Adopt tokens another tab obtained, so this one never needs to refresh. */
  useEffect(() => subscribeToTokenBroadcasts(), []);

  /*
   * Connect auth to the HTTP client.
   *
   * Registered in an effect and torn down on unmount so the hooks cannot
   * outlive the provider — in tests especially, a stale registration would
   * have one test's auth state answering another test's requests.
   */
  useEffect(
    () =>
      installAuthHooks(() => {
        dispatch({ type: 'REFRESH_FAILED' });
      }),
    [],
  );

  const login = useCallback(async (credentials: LoginRequest) => {
    dispatch({ type: 'LOGIN_STARTED' });

    try {
      const result = await authService.login(credentials);

      // Persist before adopt, exactly as in the coordinator: if the write
      // fails we must not proceed with a session that cannot survive a reload.
      await setStoredRefreshToken(result.refreshToken);
      setAccessToken(result.accessToken, result.expiresIn);

      // Login gives us a notarianId and a username but no numeric id — hence
      // B3's /user/me, without which the client cannot answer "is this me?"
      // about any ownerId, actorId or lastModifiedBy in the API.
      const user = await authService.getCurrentUser();

      dispatch({ type: 'LOGIN_SUCCEEDED', user });
    } catch (error) {
      await clearSession();
      dispatch({ type: 'LOGIN_FAILED' });
      // Rethrown so the form can render the specific problem — 401 for bad
      // credentials, 403 for an unverified account, which routes to OTP.
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      /*
       * Swallowed. A user who clicked "sign out" must end up signed out
       * whether or not the server heard about it — the alternative is someone
       * stuck in a session they explicitly left because their connection
       * dropped. The local tokens go regardless, and the server session
       * expires on its own.
       */
    }

    await clearSession();
    dispatch({ type: 'LOGGED_OUT' });
  }, []);

  return <AuthContext value={{ state, login, logout }}>{children}</AuthContext>;
}
