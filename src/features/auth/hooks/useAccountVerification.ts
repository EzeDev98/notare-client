/** Resends the account verification email. */
import { useCallback } from 'react';

import { authService } from '@/features/auth/api/authService';

export function useAccountVerification() {
  const resend = useCallback(async (identifier: string): Promise<void> => {
    try {
      await authService.resendActivation({ notarianIdOrEmail: identifier });
    } catch {}
  }, []);

  return { resend };
}
