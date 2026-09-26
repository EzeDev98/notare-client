import { ensureFreshAccessToken, isRefreshRejected } from '@/features/auth/refreshCoordinator';
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
      } catch (error) {
        // Transient failure (offline, timeout, 5xx): send the request with the
        // token we have and leave the session and the screen alone.
        if (!isRefreshRejected(error)) return headerFor(getAccessToken());

        // Terminal: the server refused the refresh token.
        onSessionExpired();
        return null;
      }
    },

    async recoverFromUnauthorized(usedAuthorization) {
      try {
        return await ensureFreshAccessToken({
          staleAccessToken: tokenFrom(usedAuthorization),
        });
      } catch (error) {
        // Only a refusal from the server is terminal; anything else just means
        // this one request fails and the caller may retry.
        if (isRefreshRejected(error)) onSessionExpired();
        return false;
      }
    },
  });

  return () => {
    setAuthHooks(null);
  };
}
