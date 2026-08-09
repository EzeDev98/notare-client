import { useCallback, useState } from 'react';

import { authService } from '@/features/auth/api/authService';
import { useAuthAction } from '@/features/auth/hooks/useAuthAction';
import type { VerifyResetOtpResponse } from '@/features/auth/types';
// MessageResponse is a shared envelope, not an auth type — it lives in
// lib/http/types alongside PagedResponse (4B).
import type { MessageResponse } from '@/lib/http/types';

/**
 * The three-step reset flow, as one hook.
 *
 * Together rather than three hooks because they share a secret: the resetToken
 * from step two is the only thing that makes step three possible, and it must
 * not leak into router state or a URL. Keeping it inside one hook means there
 * is exactly one place it can live.
 */
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
        // confirmNewPassword, NOT confirmPassword — the reset DTO differs from
        // registration's. Verified against the server source in 4B.
        confirmNewPassword: newPassword,
      }),
    [],
  );

  // Identical response whether or not the email is registered, so the only
  // honest failure message is a transport one.
  const requestAction = useAuthAction(request, 'Something went wrong. Please try again.');
  const verifyAction = useAuthAction(verify, 'That code is invalid or has expired.');
  const completeAction = useAuthAction(complete, 'That reset link has expired. Start again.');

  return {
    resetToken,
    setResetToken,
    requestAction,
    verifyAction,
    completeAction,
  };
}
