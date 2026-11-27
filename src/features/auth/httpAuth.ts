/** Connects auth to the HTTP client. */
import { ensureFreshAccessToken, isRefreshRejected } from '@/features/auth/refreshCoordinator';
import { getAccessToken } from '@/features/auth/tokenStore';
import { setAuthHooks } from '@/lib/http/authHooks';

const BEARER = 'Bearer ';

function headerFor(token: string | null): string | null {
  return token === null ? null : `${BEARER}${token}`;
}

function tokenFrom(authorization: string | null): string | null {
  if (authorization === null) return null;
  return authorization.startsWith(BEARER) ? authorization.slice(BEARER.length) : null;
}

export function installAuthHooks(onSessionExpired: () => void): () => void {
  setAuthHooks({
    async getAuthorization() {
      try {
        const hasSession = await ensureFreshAccessToken();
        return hasSession ? headerFor(getAccessToken()) : null;
      } catch (error) {
        if (!isRefreshRejected(error)) return headerFor(getAccessToken());

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
        if (isRefreshRejected(error)) onSessionExpired();
        return false;
      }
    },
  });

  return () => {
    setAuthHooks(null);
  };
}
