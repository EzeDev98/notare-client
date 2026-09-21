import type {
  CurrentUser,
  ForgotPasswordRequest,
  LoginRequest,
  LoginResponse,
  LogoutResponse,
  RegistrationRequest,
  RegistrationResponse,
  ResendActivationRequest,
  ResetPasswordRequest,
  SessionResponse,
  TokenResponse,
  VerifyResetOtpRequest,
  VerifyResetOtpResponse,
} from '@/features/auth/types';
import { httpClient } from '@/lib/http/client';
import type { MessageResponse } from '@/lib/http/types';

/**
 * The auth API surface. Paths in one place, because two of them are wrong in a
 * way that is easy to "fix" incorrectly.
 *
 * THE DOUBLED SEGMENTS ARE REAL. LoginController declares
 * @RequestMapping("${app.title}/login") AND @PostMapping("/login"), so the
 * path really is /api/v1/login/login. Same for logout. It is known bug 14.4 on
 * the server — cosmetic there, load-bearing here: calling /login gets a 404.
 * Verified against the source rather than assumed. When the server fixes it,
 * this block is the only thing that changes.
 */
const PATHS = {
  login: '/login/login',
  logout: '/logout/logout',
  logoutAll: '/logout/logout-all',
  refresh: '/auth/refresh',
  register: '/user/register',
  me: '/user/me',
  resendActivation: '/activation/resend',
  forgotPassword: '/password/forgot-password',
  verifyResetOtp: '/password/verify-reset-otp',
  resetPassword: '/password/reset-password',
  sessions: '/session/sessions',
} as const;

interface Cancellable {
  signal?: AbortSignal;
}

export const authService = {
  /**
   * A 403 here is NOT a permission problem — it means the account exists and
   * is unverified (DisabledException). The UI routes to OTP verification
   * rather than showing a generic error.
   */
  login(body: LoginRequest, { signal }: Cancellable = {}): Promise<LoginResponse> {
    return httpClient.post<LoginResponse>(PATHS.login, { body, ...(signal ? { signal } : {}) });
  },

  /**
   * Exchanges a refresh token for a NEW PAIR — both tokens rotate.
   *
   * Called only from 4D's single-flight path. Calling it from anywhere else is
   * a session-destroying bug on this server: a second call with the same token
   * is treated as reuse and deletes the session record.
   */
  refresh(refreshToken: string, { signal }: Cancellable = {}): Promise<TokenResponse> {
    return httpClient.post<TokenResponse>(PATHS.refresh, {
      body: { refreshToken },
      /*
       * The ONE endpoint that opts out of the interceptor.
       *
       * This call runs INSIDE the refresh lock, and Web Locks are not
       * reentrant: a 401 here would try to acquire a lock it already holds and
       * hang forever, with no error to explain why the app stopped.
       */
      auth: false,
      ...(signal ? { signal } : {}),
    });
  },

  register(body: RegistrationRequest, { signal }: Cancellable = {}): Promise<RegistrationResponse> {
    return httpClient.post<RegistrationResponse>(PATHS.register, {
      body,
      ...(signal ? { signal } : {}),
    });
  },

  /** The numeric id the rest of the API identifies people by (B3). */
  getCurrentUser({ signal }: Cancellable = {}): Promise<CurrentUser> {
    return httpClient.get<CurrentUser>(PATHS.me, { ...(signal ? { signal } : {}) });
  },

  /**
   * Re-sends the email-verification link. The identifier is a notarianId OR
   * an email. Verification itself happens on internal-auth via the emailed
   * link, so there is no code to submit.
   *
   * ALWAYS 200, whether or not the account exists, so nothing in the response
   * can be used to probe for registered addresses. The UI runs its own visible
   * cooldown for that reason.
   */
  resendActivation(
    body: ResendActivationRequest,
    { signal }: Cancellable = {},
  ): Promise<MessageResponse> {
    return httpClient.post<MessageResponse>(PATHS.resendActivation, {
      body,
      ...(signal ? { signal } : {}),
    });
  },

  /** Identical response whether or not the email is registered. */
  forgotPassword(
    body: ForgotPasswordRequest,
    { signal }: Cancellable = {},
  ): Promise<MessageResponse> {
    return httpClient.post<MessageResponse>(PATHS.forgotPassword, {
      body,
      ...(signal ? { signal } : {}),
    });
  },

  /** Returns the short-lived resetToken the final step requires. */
  verifyResetOtp(
    body: VerifyResetOtpRequest,
    { signal }: Cancellable = {},
  ): Promise<VerifyResetOtpResponse> {
    return httpClient.post<VerifyResetOtpResponse>(PATHS.verifyResetOtp, {
      body,
      ...(signal ? { signal } : {}),
    });
  },

  /** Note confirmNewPassword — the reset DTO differs from registration's. */
  resetPassword(
    body: ResetPasswordRequest,
    { signal }: Cancellable = {},
  ): Promise<MessageResponse> {
    return httpClient.post<MessageResponse>(PATHS.resetPassword, {
      body,
      ...(signal ? { signal } : {}),
    });
  },

  /** No body — the session comes from the token's `sid` claim. */
  logout({ signal }: Cancellable = {}): Promise<LogoutResponse> {
    return httpClient.post<LogoutResponse>(PATHS.logout, { ...(signal ? { signal } : {}) });
  },

  /** Every session, everywhere. What a user reaches for after losing a device. */
  logoutAll({ signal }: Cancellable = {}): Promise<LogoutResponse> {
    return httpClient.post<LogoutResponse>(PATHS.logoutAll, { ...(signal ? { signal } : {}) });
  },

  listSessions({ signal }: Cancellable = {}): Promise<SessionResponse[]> {
    return httpClient.get<SessionResponse[]>(PATHS.sessions, { ...(signal ? { signal } : {}) });
  },

  revokeSession(sessionId: string, { signal }: Cancellable = {}): Promise<void> {
    return httpClient.delete<void>(`${PATHS.sessions}/${sessionId}`, {
      ...(signal ? { signal } : {}),
    });
  },
};
