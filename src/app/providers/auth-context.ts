import { createContext, use } from 'react';

import type { AuthState, LoginRequest } from '@/features/auth/types';

export interface AuthContextValue {
  state: AuthState;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  /** Renew an expired session with the password, without unmounting the app (step 14a). */
  reauthenticate: (password: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Separated from AuthProvider.tsx so that file exports only a component and
 * stays Fast Refresh-friendly — the same split 2D needed for useTheme.
 */
export function useAuth(): AuthContextValue {
  const context = use(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within <AuthProvider>.');
  }
  return context;
}
