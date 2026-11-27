/** Registers a new account. */
import { useCallback } from 'react';

import { REGISTER_CONFLICT } from '@/features/auth/authContent';
import { authService } from '@/features/auth/api/authService';
import { useAuthAction } from '@/features/auth/hooks/useAuthAction';
import type { RegistrationRequest, RegistrationResponse } from '@/features/auth/types';

export function useRegistration() {
  const register = useCallback(
    (body: RegistrationRequest): Promise<RegistrationResponse> => authService.register(body),
    [],
  );

  return useAuthAction(register, REGISTER_CONFLICT);
}
