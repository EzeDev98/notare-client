import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installAuthHooks } from '@/features/auth/httpAuth';
import { resetRefreshCoordinatorForTests } from '@/features/auth/refreshCoordinator';
import {
  clearSession,
  resetTokenStoreForTests,
  setAccessToken,
  setStoredRefreshToken,
} from '@/features/auth/tokenStore';
import { httpClient } from '@/lib/http/client';
import { setAuthHooks } from '@/lib/http/authHooks';
import { server } from '~/msw/server';

const BASE = 'http://localhost:2001/api/v1';

let refreshCalls = 0;
let notesAuthHeaders: (string | null)[] = [];
let uninstall: (() => void) | undefined;
const onSessionExpired = vi.fn();

beforeEach(async () => {
  refreshCalls = 0;
  notesAuthHeaders = [];
  onSessionExpired.mockClear();

  resetRefreshCoordinatorForTests();
  resetTokenStoreForTests();
  await clearSession();

  uninstall = installAuthHooks(onSessionExpired);

  server.use(
    http.post(`${BASE}/auth/refresh`, async ({ request }) => {
      refreshCalls += 1;
      const body = (await request.json()) as { refreshToken: string };

      if (body.refreshToken !== 'refresh-current') {
        return HttpResponse.json(
          { title: 'Unauthorized', status: 401, detail: 'Invalid refresh token.' },
          { status: 401, headers: { 'content-type': 'application/problem+json' } },
        );
      }
      return HttpResponse.json({
        accessToken: 'access-new',
        refreshToken: 'refresh-current',
        tokenType: 'Bearer',
        expiresIn: 900_000,
      });
    }),
  );
});

afterEach(() => {
  uninstall?.();
  setAuthHooks(null);
  resetRefreshCoordinatorForTests();
});

/** Answers 401 for anything but the expected token. */
function notesRequiring(expected: string): void {
  server.use(
    http.get(`${BASE}/notes`, ({ request }) => {
      const header = request.headers.get('authorization');
      notesAuthHeaders.push(header);

      if (header !== `Bearer ${expected}`) {
        return HttpResponse.json(
          { title: 'Unauthorized', status: 401, detail: 'Session expired.' },
          { status: 401, headers: { 'content-type': 'application/problem+json' } },
        );
      }
      return HttpResponse.json({
        content: [],
        page: 0,
        size: 20,
        totalElements: 0,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
      });
    }),
  );
}

describe('attaching credentials', () => {
  it('sends no Authorization header when there is no session', async () => {
    notesRequiring('never-matches');
    await httpClient.get('/notes').catch(() => undefined);

    expect(notesAuthHeaders[0]).toBeNull();
    expect(refreshCalls).toBe(0);
  });

  it('attaches the access token when there is one', async () => {
    setAccessToken('access-current', 900_000);
    await setStoredRefreshToken('refresh-current');
    notesRequiring('access-current');

    await httpClient.get('/notes');

    expect(notesAuthHeaders).toEqual(['Bearer access-current']);
    expect(refreshCalls).toBe(0);
  });

  it('refreshes PROACTIVELY when the token is near expiry, avoiding the 401', async () => {
    // 10s left, inside the 30s skew. Fewer failed requests — and on this
    // server, fewer chances for two requests to race into two refreshes.
    setAccessToken('access-old', 10_000);
    await setStoredRefreshToken('refresh-current');
    notesRequiring('access-new');

    await httpClient.get('/notes');

    expect(refreshCalls).toBe(1);
    expect(notesAuthHeaders).toEqual(['Bearer access-new']);
  });
});

describe('recovering from a 401', () => {
  it('refreshes and retries exactly once', async () => {
    // Token looks fresh but the server has revoked it — the freshness check
    // cannot detect this, which is why the forced path exists.
    setAccessToken('access-revoked', 900_000);
    await setStoredRefreshToken('refresh-current');
    notesRequiring('access-new');

    await httpClient.get('/notes');

    expect(notesAuthHeaders).toEqual(['Bearer access-revoked', 'Bearer access-new']);
    expect(refreshCalls).toBe(1);
  });

  it('does not retry a second time', async () => {
    setAccessToken('access-revoked', 900_000);
    await setStoredRefreshToken('refresh-current');
    notesRequiring('something-else-entirely');

    await expect(httpClient.get('/notes')).rejects.toThrow();

    /*
     * Two attempts, never three. A second 401 after a successful refresh means
     * the token is not the problem — the endpoint genuinely refuses — and
     * retrying again is a loop the server cannot defend against.
     */
    expect(notesAuthHeaders).toHaveLength(2);
  });

  it('makes ONE refresh for several requests that all hit a 401', async () => {
    setAccessToken('access-revoked', 900_000);
    await setStoredRefreshToken('refresh-current');
    notesRequiring('access-new');

    await Promise.all([
      httpClient.get('/notes'),
      httpClient.get('/notes'),
      httpClient.get('/notes'),
    ]);

    /*
     * §12's requirement, and there is no queue in the implementation. Every
     * request awaits the same Web Lock, so the first refreshes and the rest
     * re-read and proceed. The queue you would otherwise hand-roll is what the
     * lock already is.
     *
     * Without this, three concurrent refreshes would present a rotated token
     * twice — which this server treats as reuse and answers by deleting the
     * session on every device.
     */
    expect(refreshCalls).toBe(1);
  });

  it('reports session expiry and stops when the refresh itself fails', async () => {
    setAccessToken('access-revoked', 900_000);
    await setStoredRefreshToken('refresh-dead');
    notesRequiring('access-new');

    await expect(httpClient.get('/notes')).rejects.toThrow();

    expect(onSessionExpired).toHaveBeenCalled();
    // No retry: the server deleted the session record, so nothing can help.
    expect(notesAuthHeaders).toHaveLength(1);
  });
});
