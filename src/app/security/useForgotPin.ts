import { useAuth } from '@/app/providers/auth-context';
import { clearPin } from '@/features/security/pinStore';

/**
 * "Forgot PIN? Sign in again." Turns the lock off and signs out, so signing in
 * brings the person back to a device with no PIN. Only this path and Turn off
 * remove the lock; a failed start-up or a dropped connection never does.
 */
export function useForgotPin(): () => Promise<void> {
  const { logout } = useAuth();
  return async () => {
    await clearPin();
    await logout();
  };
}
