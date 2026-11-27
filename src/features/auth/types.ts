/** Auth types. */
import type { ServerDateTime } from '@/lib/http/types';

export interface CurrentUser {
  id: number;
  notarianId: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: ServerDateTime;
}

export type AuthState =
  | { status: 'initializing' }
  | { status: 'unauthenticated' }
  | { status: 'authenticating' }
  | { status: 'authenticated'; user: CurrentUser }
  | { status: 'refreshing'; user: CurrentUser }
  | { status: 'session-expired'; reason: 'refresh-failed' | 'revoked'; user: CurrentUser | null };

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  usernameOrEmail: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  notarianId: string;
  username: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface RegistrationRequest {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface RegistrationResponse {
  statusCode: number;
  message: string;
  notarianId: string;
}

export interface ResendActivationRequest {
  notarianIdOrEmail: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface VerifyResetOtpRequest {
  email: string;
  code: string;
}

export interface VerifyResetOtpResponse {
  resetToken: string;
}

export interface ResetPasswordRequest {
  resetToken: string;
  newPassword: string;
  confirmNewPassword: string;
}

export interface LogoutResponse {
  statusCode: number;
  message: string;
}
