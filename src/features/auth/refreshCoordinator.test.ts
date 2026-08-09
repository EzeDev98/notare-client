import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  ensureFreshAccessToken,
  resetRefreshCoordinatorForTests,
} from '@/features/auth/refreshCoordinator';
import {
  clearSession,
  getAccessToken,
  getStoredRefreshToken,
  resetTokenStoreForTests,
  setAccessToken,
  setStoredRefreshToken,
} from '@/features/auth/tokenStore';
import { server } from '~/msw/server';

const BASE = 'http://localhost:2001/api/v1';

let refreshCalls = 0;

beforeEach(async () => {
  refreshCalls = 0;
  resetRefreshCoordinatorForTests();
  resetTokenStoreForTests();
  await clearSession();

  server.use(
    http.post(`${BASE}/auth/refresh`, async ({ request }) => {
      refreshCalls += 1;
      const body = (await request.json()) as { refreshToken: string };

      // Mirrors reuse detection: anything but the current token is rejected,
      // and on the real server the session record is deleted outright.
      if (body.refreshToken !== 'refresh-current') {
        return HttpResponse.json(
          { title: 'Unauthorized', status: 401, detail: 'Invalid refresh token.' },
          { status: 401, headers: { 'content-type': 'application/problem+json' } },
        );
      }

      return HttpResponse.json({
        accessToken: 'access-new',
        refreshToken: 'refresh-new',
        tokenType: 'Bearer',
        expiresIn: 900_000,
      });
    }),
  );
});

afterEach(() => {
  resetRefreshCoordinatorForTests();
});

describe('ensureFreshAccessToken', () => {
  it('reports no session when nothing is stored', async () => {
    await expect(ensureFreshAccessToken()).resolves.toBe(false);
    expect(refreshCalls).toBe(0);
  });

  it('does not refresh when the access token is still fresh', async () => {
    setAccessToken('access-current', 900_000);
    await setStoredRefreshToken('refresh-current');

    await expect(ensureFreshAccessToken()).resolves.toBe(true);

    // The re-read inside the lock: acquiring it is not the same as needing to
    // act, and refreshing unnecessarily burns a token for nothing.
    expect(refreshCalls).toBe(0);
  });

  it('refreshes and persists the rotated token before adopting the access token', async () => {
    await setStoredRefreshToken('refresh-current');

    await expect(ensureFreshAccessToken()).resolves.toBe(true);

    expect(getAccessToken()).toBe('access-new');
    // The old token is dead the moment the server responded; if this were not
    // stored, the next reload would present it and the session would be
    // deleted as a reuse attempt.
    await expect(getStoredRefreshToken()).resolves.toBe('refresh-new');
  });

  it('makes exactly ONE refresh call for concurrent callers', async () => {
    await setStoredRefreshToken('refresh-current');

    /*
     * THE TEST THIS WHOLE SUBSECTION EXISTS FOR.
     *
     * Five simultaneous callers. Without single-flight, the first rotates and
     * the other four present a token the server has already invalidated —
     * which it treats as reuse and answers by DELETING THE SESSION. Not a 401
     * to retry: a hard logout on every device.
     */
    const results = await Promise.all([
      ensureFreshAccessToken(),
      ensureFreshAccessToken(),
      ensureFreshAccessToken(),
      ensureFreshAccessToken(),
      ensureFreshAccessToken(),
    ]);

    expect(results).toEqual([true, true, true, true, true]);
    expect(refreshCalls).toBe(1);
  });

  it('clears the session and rethrows when the refresh is rejected', async () => {
    await setStoredRefreshToken('refresh-stale');

    await expect(ensureFreshAccessToken()).rejects.toThrow();

    // Terminal: the server record is gone, so keeping a dead token around
    // would only produce a second failure later, further from the cause.
    expect(getAccessToken()).toBeNull();
    await expect(getStoredRefreshToken()).resolves.toBeNull();
  });
});
