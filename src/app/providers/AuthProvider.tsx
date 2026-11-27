/** Holds the session and gives it to the app. */
import { sessionUserOf } from '@/features/auth/sessionUser';
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialAuthState);

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

        const user = await authService.getCurrentUser();
        if (cancelled) return;

        dispatch({ type: 'INIT_RESTORED', user });
      } catch {
        if (cancelled) return;
        dispatch({ type: 'INIT_NO_SESSION' });
      }
    }

    void restore();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => subscribeToTokenBroadcasts(), []);

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

      await setStoredRefreshToken(result.refreshToken);
      setAccessToken(result.accessToken, result.expiresIn);

      const user = await authService.getCurrentUser();

      dispatch({ type: 'LOGIN_SUCCEEDED', user });
    } catch (error) {
      await clearSession();
      dispatch({ type: 'LOGIN_FAILED' });
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {}

    await clearSession();
    dispatch({ type: 'LOGGED_OUT' });
  }, []);

  const reauthenticate = useCallback(
    async (password: string) => {
      const current = sessionUserOf(state);
      if (current === null) throw new Error('There is no session to renew.');

      const result = await authService.login({ usernameOrEmail: current.username, password });
      await setStoredRefreshToken(result.refreshToken);
      setAccessToken(result.accessToken, result.expiresIn);

      const user = await authService.getCurrentUser();
      dispatch({ type: 'LOGIN_SUCCEEDED', user });
    },
    [state],
  );

  return <AuthContext value={{ state, login, logout, reauthenticate }}>{children}</AuthContext>;
}
