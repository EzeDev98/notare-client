import type { ServerDateTime } from '@/lib/http/types';

/* ===========================================================================
 * Domain state
 * ======================================================================== */

/**
 * The authenticated caller's own profile — GET /user/me (B3).
 *
 * The `id` is why that endpoint had to exist: LoginResponse returns only
 * notarianId and username, while every other payload identifies people by
 * numeric id.
 */
export interface CurrentUser {
  id: number;
  notarianId: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: ServerDateTime;
}

/**
 * Every state the session can be in.
 *
 * A union rather than isAuthenticated + user + isLoading — three booleans
 * describe eight combinations, four of which are nonsense.
 */
export type AuthState =
  /** Reading persisted state. NOT unauthenticated: collapsing the two flashes
   *  the login screen on every reload. Distinct because the token store is
   *  async — there is a real window where the answer is unknown. */
  | { status: 'initializing' }
  | { status: 'unauthenticated' }
  | { status: 'authenticating' }
  | { status: 'authenticated'; user: CurrentUser }
  /** Renders exactly as authenticated. Exists so 4D can avoid starting a
   *  second refresh, not so the UI can show something. */
  | { status: 'refreshing'; user: CurrentUser }
  /** The session ended and the user did not ask for it. Needs an explanation,
   *  and unsaved local work must survive. Terminal for the refresh path.
   *  `user` is who was signed in, so their notes stay on screen (step 14a). */
  | { status: 'session-expired'; reason: 'refresh-failed' | 'revoked'; user: CurrentUser | null };

export interface AuthTokens {
  accessToken: string;
  /** ROTATED on every use. Presenting a previous one deletes the session. */
  refreshToken: string;
  /** MILLISECONDS. app.jwt.expiration-ms is 900000 (15 min). Read as seconds
   *  this is 15,000 minutes and the client never refreshes. */
  expiresIn: number;
}

/* ===========================================================================
 * Wire types — mirroring the server's DTOs exactly
 * ======================================================================== */

export interface LoginRequest {
  /** Either. The server resolves both against username and email. */
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
  /* No numeric id — hence GET /user/me. */
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

/** Bespoke envelope: statusCode is duplicated in the body. */
export interface RegistrationResponse {
  statusCode: number;
  message: string;
  /** Shown once, here. Since B6 the client no longer has to persist it —
   *  verification accepts an email too. */
  notarianId: string;
}

export interface ResendActivationRequest {
  /** Either form; told apart by '@', which a notarianId cannot contain. */
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
  /** confirmNewPassword, NOT confirmPassword — the reset DTO differs from
   *  registration's. Verified against the server source. */
  confirmNewPassword: string;
}

export interface LogoutResponse {
  statusCode: number;
  message: string;
}
