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
  gender: string;
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
   *  and unsaved local work must survive. Terminal for the refresh path. */
  | { status: 'session-expired'; reason: 'refresh-failed' | 'revoked' };

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

/**
 * Session timestamps, which are Java Instant and DO carry a Z.
 *
 * A separate alias from ServerDateTime on purpose: everything else in this API
 * is LocalDateTime with no zone at all. new Date() is correct on this one and
 * silently wrong by the local offset on the other, and the type name is the
 * only thing standing between a reader and that mistake.
 */
export type ServerInstant = string;

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
  /* Mirrors com.notare.feature.user.enums.Gender exactly: two constants. */
  gender: 'MALE' | 'FEMALE';
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

export interface VerifyOtpRequest {
  /** B6: either form. The two are told apart by '@', which a notarianId
   *  cannot contain. */
  notarianIdOrEmail: string;
  code: string;
}

export interface ResendOtpRequest {
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

export interface SessionResponse {
  sessionId: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: ServerInstant;
  lastUsedAt: ServerInstant;
  expiresAt: ServerInstant;
  /** True for the session making the request — so the UI can label it and
   *  warn before revoking it. */
  current: boolean;
}

export interface LogoutResponse {
  statusCode: number;
  message: string;
}
