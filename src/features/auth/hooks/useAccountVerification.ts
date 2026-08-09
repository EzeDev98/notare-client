import { useCallback } from 'react';

import { authService } from '@/features/auth/api/authService';
import { useAuthAction } from '@/features/auth/hooks/useAuthAction';
import type { MessageResponse } from '@/lib/http/types';

/**
 * Verifying an account, and requesting a new code.
 *
 * Both live here because they are two halves of one screen's behaviour, and
 * because the resend has a rule the caller must not get wrong: the server
 * answers 200 whether or not the account exists, AND (since B6) swallows its
 * own cooldown rather than returning 429 — 200-then-429 versus 200-twice was a
 * registered-address oracle in two requests.
 *
 * So a resend failure is not reportable. Anything we said would undo the
 * reason the server is vague.
 */
export function useAccountVerification() {
  const verify = useCallback(
    (identifier: string, code: string): Promise<MessageResponse> =>
      authService.verifyOtp({ notarianIdOrEmail: identifier, code }),
    [],
  );

  const action = useAuthAction(verify, 'That code is invalid or has expired.');

  const resend = useCallback(async (identifier: string): Promise<void> => {
    try {
      await authService.resendOtp({ notarianIdOrEmail: identifier });
    } catch {
      // Deliberately silent — see above.
    }
  }, []);

  return { ...action, resend };
}
