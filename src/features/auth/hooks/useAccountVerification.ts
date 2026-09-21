import { useCallback } from 'react';

import { authService } from '@/features/auth/api/authService';

/**
 * Re-sending the verification email.
 *
 * Verification itself now happens on internal-auth through the emailed link,
 * so this screen only ever needs the resend. The server answers 200 whether or
 * not the account exists, so a failure is deliberately not reportable:
 * anything we said would undo the reason the server is vague.
 */
export function useAccountVerification() {
  const resend = useCallback(async (identifier: string): Promise<void> => {
    try {
      await authService.resendActivation({ notarianIdOrEmail: identifier });
    } catch {
      // Deliberately silent — see above.
    }
  }, []);

  return { resend };
}
