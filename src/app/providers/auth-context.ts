/** The auth context and its hook. */
import { createContext, use } from 'react';

import type { AuthState, LoginRequest } from '@/features/auth/types';

export interface AuthContextValue {
  state: AuthState;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  reauthenticate: (password: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = use(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within <AuthProvider>.');
  }
  return context;
}
