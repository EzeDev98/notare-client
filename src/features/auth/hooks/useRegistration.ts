import { useCallback } from 'react';

import { REGISTER_CONFLICT } from '@/features/auth/authContent';
import { authService } from '@/features/auth/api/authService';
import { useAuthAction } from '@/features/auth/hooks/useAuthAction';
import type { RegistrationRequest, RegistrationResponse } from '@/features/auth/types';

/**
 * Registration, with its failure vocabulary.
 *
 * The fallback message is specific because the server's 409 for a taken
 * username or email arrives with no field detail — a generic "something went
 * wrong" would leave the user re-submitting the same form forever.
 */
export function useRegistration() {
  const register = useCallback(
    (body: RegistrationRequest): Promise<RegistrationResponse> => authService.register(body),
    [],
  );

  return useAuthAction(register, REGISTER_CONFLICT);
}
