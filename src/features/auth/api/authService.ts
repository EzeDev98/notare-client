/** Server calls for sign-in, registration, sessions and password reset. */
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
  TokenResponse,
  VerifyResetOtpRequest,
  VerifyResetOtpResponse,
} from '@/features/auth/types';
import { httpClient } from '@/lib/http/client';
import type { MessageResponse } from '@/lib/http/types';

const PATHS = {
  login: '/login/login',
  logout: '/logout/logout',
  refresh: '/auth/refresh',
  register: '/user/register',
  me: '/user/me',
  resendActivation: '/activation/resend',
  forgotPassword: '/password/forgot-password',
  verifyResetOtp: '/password/verify-reset-otp',
  resetPassword: '/password/reset-password',
} as const;

interface Cancellable {
  signal?: AbortSignal;
}

export const authService = {
  login(body: LoginRequest, { signal }: Cancellable = {}): Promise<LoginResponse> {
    return httpClient.post<LoginResponse>(PATHS.login, { body, ...(signal ? { signal } : {}) });
  },

  refresh(refreshToken: string, { signal }: Cancellable = {}): Promise<TokenResponse> {
    return httpClient.post<TokenResponse>(PATHS.refresh, {
      body: { refreshToken },
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

  getCurrentUser({ signal }: Cancellable = {}): Promise<CurrentUser> {
    return httpClient.get<CurrentUser>(PATHS.me, { ...(signal ? { signal } : {}) });
  },

  resendActivation(
    body: ResendActivationRequest,
    { signal }: Cancellable = {},
  ): Promise<MessageResponse> {
    return httpClient.post<MessageResponse>(PATHS.resendActivation, {
      body,
      ...(signal ? { signal } : {}),
    });
  },

  forgotPassword(
    body: ForgotPasswordRequest,
    { signal }: Cancellable = {},
  ): Promise<MessageResponse> {
    return httpClient.post<MessageResponse>(PATHS.forgotPassword, {
      body,
      ...(signal ? { signal } : {}),
    });
  },

  verifyResetOtp(
    body: VerifyResetOtpRequest,
    { signal }: Cancellable = {},
  ): Promise<VerifyResetOtpResponse> {
    return httpClient.post<VerifyResetOtpResponse>(PATHS.verifyResetOtp, {
      body,
      ...(signal ? { signal } : {}),
    });
  },

  resetPassword(
    body: ResetPasswordRequest,
    { signal }: Cancellable = {},
  ): Promise<MessageResponse> {
    return httpClient.post<MessageResponse>(PATHS.resetPassword, {
      body,
      ...(signal ? { signal } : {}),
    });
  },

  logout({ signal }: Cancellable = {}): Promise<LogoutResponse> {
    return httpClient.post<LogoutResponse>(PATHS.logout, { ...(signal ? { signal } : {}) });
  },
};
