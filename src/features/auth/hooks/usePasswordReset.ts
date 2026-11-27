/** Runs the password reset flow. */
import { useCallback, useState } from 'react';

import { ERRORS, RESET_MESSAGES } from '@/features/auth/authContent';
import { authService } from '@/features/auth/api/authService';
import { useAuthAction } from '@/features/auth/hooks/useAuthAction';
import type { VerifyResetOtpResponse } from '@/features/auth/types';
import type { MessageResponse } from '@/lib/http/types';

export function usePasswordReset() {
  const [resetToken, setResetToken] = useState<string | null>(null);

  const request = useCallback(
    (email: string): Promise<MessageResponse> => authService.forgotPassword({ email }),
    [],
  );

  const verify = useCallback(
    (email: string, code: string): Promise<VerifyResetOtpResponse> =>
      authService.verifyResetOtp({ email, code }),
    [],
  );

  const complete = useCallback(
    (token: string, newPassword: string): Promise<MessageResponse> =>
      authService.resetPassword({
        resetToken: token,
        newPassword,
        confirmNewPassword: newPassword,
      }),
    [],
  );

  const requestAction = useAuthAction(request, ERRORS.generic);
  const verifyAction = useAuthAction(verify, ERRORS.wrongCode);
  const completeAction = useAuthAction(complete, RESET_MESSAGES.linkExpired);

  return {
    resetToken,
    setResetToken,
    requestAction,
    verifyAction,
    completeAction,
  };
}
