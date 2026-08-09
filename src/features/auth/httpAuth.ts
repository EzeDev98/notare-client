import { ensureFreshAccessToken } from '@/features/auth/refreshCoordinator';
import { getAccessToken } from '@/features/auth/tokenStore';
import { setAuthHooks } from '@/lib/http/authHooks';

/**
 * Registers auth with the HTTP client.
 *
 * features -> lib is the allowed direction (1C), which is the whole point of
 * the hook interface: httpClient never mentions a session, and this module
 * never mentions a URL.
 */

const BEARER = 'Bearer ';

function headerFor(token: string | null): string | null {
  return token === null ? null : `${BEARER}${token}`;
}

function tokenFrom(authorization: string | null): string | null {
  if (authorization === null) return null;
  return authorization.startsWith(BEARER) ? authorization.slice(BEARER.length) : null;
}

/**
 * @param onSessionExpired called when a refresh fails terminally, so the
 * provider can move to session-expired. A callback rather than an import,
 * because this module must not know React exists.
 */
export function installAuthHooks(onSessionExpired: () => void): () => void {
  setAuthHooks({
    async getAuthorization() {
      try {
        const hasSession = await ensureFreshAccessToken();
        return hasSession ? headerFor(getAccessToken()) : null;
      } catch {
        /*
         * A terminal refresh failure. The request continues WITHOUT a header
         * and will get a 401 — which is correct: the user sees the request
         * fail while the session-expired screen appears, rather than the
         * request hanging while the app decides what to do.
         */
        onSessionExpired();
        return null;
      }
    },

    async recoverFromUnauthorized(usedAuthorization) {
      try {
        return await ensureFreshAccessToken({
          staleAccessToken: tokenFrom(usedAuthorization),
        });
      } catch {
        // Terminal. No retry helps — the server deleted the session record.
        onSessionExpired();
        return false;
      }
    },
  });

  return () => {
    setAuthHooks(null);
  };
}
