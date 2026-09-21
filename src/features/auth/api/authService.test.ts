import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { authService } from '@/features/auth/api/authService';
import { fieldErrors, isForbidden, isUnauthorized } from '@/lib/http/errors';
import { problemDetail, validationFailure } from '~/fixtures/errors';
import { server } from '~/msw/server';

const BASE = 'http://localhost:2001/api/v1';

let lastRequest: Request | undefined;
let lastBody: unknown;

beforeEach(() => {
  lastRequest = undefined;
  lastBody = undefined;
  server.events.on('request:start', ({ request }) => {
    lastRequest = request;
    // Clone before the handler reads it — a request body is a single-use
    // stream, and cloning after the read gives "TypeError: unusable".
    void request
      .clone()
      .text()
      .then((text) => {
        lastBody = text === '' ? undefined : (JSON.parse(text) as unknown);
      })
      .catch(() => {
        lastBody = undefined;
      });
  });
});

afterEach(() => {
  server.events.removeAllListeners();
});

describe('login', () => {
  it('posts to the doubled path the server actually exposes', async () => {
    await authService.login({ usernameOrEmail: 'testuser', password: 'Passw0rd' });

    // /login/login, not /login. Known bug 14.4 — cosmetic on the server,
    // a 404 here if we "correct" it.
    expect(lastRequest?.url).toBe(`${BASE}/login/login`);
  });

  it('returns tokens with expiresIn in MILLISECONDS', async () => {
    const result = await authService.login({ usernameOrEmail: 'testuser', password: 'Passw0rd' });

    // 900000 ms = 15 minutes. Read as seconds it is 15,000 minutes and the
    // client never refreshes at all.
    expect(result.expiresIn).toBe(900_000);
    expect(result.refreshToken).toBe('refresh-1');
  });

  it('surfaces 401 for bad credentials', async () => {
    server.use(
      http.post(`${BASE}/login/login`, () =>
        problemDetail(401, { title: 'Unauthorized', detail: 'Invalid credentials.' }),
      ),
    );

    const error = await authService
      .login({ usernameOrEmail: 'testuser', password: 'wrong' })
      .catch((e: unknown) => e);

    expect(isUnauthorized(error)).toBe(true);
  });

  it('surfaces 403 for an unverified account, which is not a permission error', async () => {
    /*
     * DisabledException. The account exists and the password was right — it is
     * simply unverified, so the UI routes to OTP entry rather than showing
     * "you do not have permission", which would be actively misleading.
     */
    server.use(
      http.post(`${BASE}/login/login`, () =>
        problemDetail(403, { title: 'Forbidden', detail: 'Please verify your email address.' }),
      ),
    );

    const error = await authService
      .login({ usernameOrEmail: 'testuser', password: 'Passw0rd' })
      .catch((e: unknown) => e);

    expect(isForbidden(error)).toBe(true);
  });
});

describe('registration', () => {
  it('returns the notarianId, which the client no longer has to keep', async () => {
    const result = await authService.register({
      firstName: 'Test',
      lastName: 'User',
      username: 'testuser',
      email: 'test@example.com',
      password: 'Passw0rd',
      confirmPassword: 'Passw0rd',
    });

    // Before B6 this value had to be persisted or the account became
    // unreachable. Verification now accepts an email, so it is informational.
    expect(result.notarianId).toBe('HIJKLMN');
  });

  it('exposes per-field validation errors', async () => {
    server.use(
      http.post(`${BASE}/user/register`, () =>
        validationFailure({
          username: 'Username must be between 3 and 30 characters.',
          password:
            'Password must contain at least one uppercase letter, one lowercase letter, and one digit.',
        }),
      ),
    );

    const error = await authService
      .register({
        firstName: 'T',
        lastName: 'U',
        username: 'ab',
        email: 'test@example.com',
        password: 'weak',
        confirmPassword: 'weak',
      })
      .catch((e: unknown) => e);

    // Only possible because B2 added the handler. Before it, every validation
    // failure was an indistinguishable 400 with no field detail at all.
    expect(fieldErrors(error)).toMatchObject({ username: expect.any(String) as string });
  });
});

describe('activation resend', () => {
  it('posts to the activation endpoint with the identifier', async () => {
    await authService.resendActivation({ notarianIdOrEmail: 'test@example.com' });

    expect(lastRequest?.url).toBe(`${BASE}/activation/resend`);
    expect(lastBody).toEqual({ notarianIdOrEmail: 'test@example.com' });
  });

  it('answers 200 for an unknown identifier', async () => {
    // Non-committal by design, so it cannot be used to probe for registered
    // addresses. The client therefore owns the visible countdown.
    await expect(
      authService.resendActivation({ notarianIdOrEmail: 'nobody@example.com' }),
    ).resolves.toMatchObject({ message: expect.any(String) as string });
  });
});

describe('password reset', () => {
  it('exchanges a code for a reset token', async () => {
    const result = await authService.verifyResetOtp({
      email: 'test@example.com',
      code: '123456',
    });

    expect(result.resetToken).toBe('reset-token-1');
  });

  it('sends confirmNewPassword, not confirmPassword', async () => {
    await authService.resetPassword({
      resetToken: 'reset-token-1',
      newPassword: 'NewPassw0rd',
      confirmNewPassword: 'NewPassw0rd',
    });

    // The reset DTO differs from registration's. Verified against the server
    // source — guessing here produces a 400 with no field detail to explain it.
    expect(lastBody).toHaveProperty('confirmNewPassword');
    expect(lastBody).not.toHaveProperty('confirmPassword');
  });
});

describe('sessions', () => {
  it('lists sessions and marks the current one', async () => {
    const sessions = await authService.listSessions();

    expect(sessions[0]?.current).toBe(true);
    // Instant, not LocalDateTime — these are the only timestamps in the API
    // that carry a zone, and new Date() is correct on them.
    expect(sessions[0]?.createdAt).toMatch(/Z$/);
  });

  it('logs out with no body, since the session comes from the token', async () => {
    await authService.logout();

    expect(lastBody).toBeUndefined();
    expect(lastRequest?.url).toBe(`${BASE}/logout/logout`);
  });
});
