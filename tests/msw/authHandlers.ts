import { http, HttpResponse } from 'msw';

const BASE = 'http://localhost:2001/api/v1';

/** The doubled segments are the real server paths — known bug 14.4. */
export const authHandlers = [
  http.post(`${BASE}/login/login`, () =>
    HttpResponse.json({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      tokenType: 'Bearer',
      expiresIn: 900_000,
      notarianId: 'ABCDEFG',
      username: 'testuser',
    }),
  ),

  http.post(`${BASE}/auth/refresh`, () =>
    HttpResponse.json({
      // BOTH rotate. The old refresh token is dead the instant this returns.
      accessToken: 'access-2',
      refreshToken: 'refresh-2',
      tokenType: 'Bearer',
      expiresIn: 900_000,
    }),
  ),

  http.get(`${BASE}/user/me`, () =>
    HttpResponse.json({
      id: 42,
      notarianId: 'ABCDEFG',
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      gender: 'MALE',
      createdAt: '2026-01-01T09:00:00.000',
    }),
  ),

  http.post(`${BASE}/user/register`, () =>
    HttpResponse.json(
      { statusCode: 201, message: 'Registration successful.', notarianId: 'HIJKLMN' },
      { status: 201 },
    ),
  ),

  http.post(`${BASE}/otp/verify-otp`, () =>
    HttpResponse.json({ message: 'Account verified successfully.' }),
  ),

  http.post(`${BASE}/otp/resend-otp`, () =>
    HttpResponse.json({ message: 'If an account with that ID exists, a new code has been sent.' }),
  ),

  http.post(`${BASE}/password/forgot-password`, () =>
    HttpResponse.json({
      message: 'If an account exists for this email, a reset code has been sent.',
    }),
  ),

  http.post(`${BASE}/password/verify-reset-otp`, () =>
    HttpResponse.json({ resetToken: 'reset-token-1' }),
  ),

  http.post(`${BASE}/password/reset-password`, () =>
    HttpResponse.json({ message: 'Password reset successfully.' }),
  ),

  http.post(`${BASE}/logout/logout`, () =>
    HttpResponse.json({ statusCode: 200, message: 'Logged out.' }),
  ),

  http.post(`${BASE}/logout/logout-all`, () =>
    HttpResponse.json({ statusCode: 200, message: 'Logged out everywhere.' }),
  ),

  // Instant, not LocalDateTime — these genuinely carry a Z.
  http.get(`${BASE}/session/sessions`, () =>
    HttpResponse.json([
      {
        sessionId: 'sess-1',
        userAgent: 'Chrome on macOS',
        ipAddress: '127.0.0.1',
        createdAt: '2026-08-01T09:00:00Z',
        lastUsedAt: '2026-08-08T10:00:00Z',
        expiresAt: '2026-08-31T09:00:00Z',
        current: true,
      },
    ]),
  ),

  http.delete(`${BASE}/session/sessions/:sessionId`, () => new HttpResponse(null, { status: 204 })),
];
