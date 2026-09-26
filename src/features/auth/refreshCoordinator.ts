import { statusOf } from '@/lib/http/errors';
import { authService } from '@/features/auth/api/authService';
import {
  clearSession,
  getAccessToken,
  isAccessTokenExpiring,
  setAccessToken,
  setStoredRefreshToken,
  getStoredRefreshToken,
} from '@/features/auth/tokenStore';

/**
 * The ONLY place that calls POST /auth/refresh.
 *
 * WHY THIS EXISTS AT ALL. The server rotates the refresh token on every use
 * and treats a stale one as reuse: SessionServiceImpl.rotateRefreshToken
 * DELETES THE SESSION RECORD on a mismatch. That is correct hardening — a
 * stolen refresh token is then useful once and its use is detectable — but it
 * makes a second concurrent refresh catastrophic rather than merely wasteful.
 * Not a 401 to retry: a hard logout on every device sharing the session.
 *
 * Two tabs are two JavaScript contexts, so the usual module-level
 * `let inFlight: Promise | null` singleton does nothing here. Serialising
 * across tabs needs the Web Locks API.
 */

const LOCK_NAME = 'notare.auth.refresh';
const CHANNEL_NAME = 'notare.auth';

/** Broadcast to other tabs after a successful refresh. */
interface TokenBroadcast {
  type: 'tokens-updated';
  accessToken: string;
  expiresIn: number;
}

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  // Absent in some older environments and in a few test runners. Optional by
  // design: without it every tab refreshes on its own schedule, serialised by
  // the lock but still N refreshes rather than one.
  if (typeof BroadcastChannel === 'undefined') return null;
  channel ??= new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

/**
 * Adopts a token another tab obtained, so this tab never needs to refresh.
 *
 * Only the ACCESS token travels. The refresh token is already in IndexedDB,
 * which is shared across tabs — broadcasting it would put a long-lived
 * credential on a channel any script on the origin can listen to, for no gain.
 */
export function subscribeToTokenBroadcasts(): () => void {
  const bus = getChannel();
  if (!bus) return () => undefined;

  const handler = (event: MessageEvent<TokenBroadcast>): void => {
    if (event.data.type === 'tokens-updated') {
      setAccessToken(event.data.accessToken, event.data.expiresIn);
    }
  };

  bus.addEventListener('message', handler);
  return () => {
    bus.removeEventListener('message', handler);
  };
}

/**
 * Runs `critical` while holding the cross-tab lock.
 *
 * navigator.locks.request serialises across every tab on the origin — the only
 * mechanism that actually prevents two tabs refreshing at once.
 *
 * The fallback chains onto a module-level promise, which is single-flight
 * WITHIN a tab and not across them. Strictly worse, and deliberate: on a
 * browser without Web Locks, one tab refreshing correctly beats every tab
 * racing.
 */
let fallbackChain: Promise<unknown> = Promise.resolve();

function withLock<T>(critical: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && 'locks' in navigator) {
    // No cast needed: LockManager.request is generic over the callback's
    // return type, so this is already Promise<T>.
    return navigator.locks.request(LOCK_NAME, critical);
  }

  const result = fallbackChain.then(critical);
  // Swallow here so one failure does not poison every later refresh.
  fallbackChain = result.catch(() => undefined);
  return result;
}

/**
 * Ensures a usable access token, refreshing only if necessary.
 *
 * Returns true when the caller can proceed with a request, false when there is
 * no session to restore.
 *
 * THROWS when a refresh was attempted and failed. That is terminal — the
 * session record is gone — and the caller transitions to session-expired.
 */
export interface EnsureOptions {
  /**
   * The token a request USED and got a 401 for.
   *
   * Present means "refresh even though the token looks fine" — the server may
   * have revoked a session that has not expired. The freshness check cannot
   * answer that, so instead we compare inside the lock: if the current token
   * differs from this one, somebody already refreshed while the request was in
   * flight and there is nothing to do. Same check-then-act discipline, a
   * different question.
   */
  staleAccessToken?: string | null;
}

/** True only when the server explicitly refused the refresh token. */
export function isRefreshRejected(error: unknown): boolean {
  const status = statusOf(error);
  return status === 400 || status === 401 || status === 403;
}

export function ensureFreshAccessToken(options: EnsureOptions = {}): Promise<boolean> {
  return withLock(async () => {
    /*
     * RE-READ INSIDE THE LOCK. By the time we acquire it, another tab may have
     * already refreshed and stored a new token — acquiring a lock is not the
     * same as needing to act. Skipping this second check is the classic
     * check-then-act bug, and here it costs the user their session.
     */
    if (options.staleAccessToken !== undefined) {
      // Forced path: somebody else already replaced the rejected token.
      if (getAccessToken() !== null && getAccessToken() !== options.staleAccessToken) {
        return true;
      }
    } else if (getAccessToken() !== null && !isAccessTokenExpiring()) {
      return true;
    }

    const refreshToken = await getStoredRefreshToken();
    if (refreshToken === null) {
      return false;
    }

    let tokens;
    try {
      tokens = await authService.refresh(refreshToken);
    } catch (error) {
      /*
       * Only a definitive refusal from the server ends the session. A network
       * drop, timeout or 5xx says nothing about the token, so it is kept and
       * the failure is simply thrown to be retried later; wiping it here is
       * what threw people out of the app on a momentary connection blip.
       * (Known gap: if the response was lost AFTER the server rotated the
       * token, the retry is treated as reuse and the server ends the session,
       * which then surfaces as a real 401 refusal. A server-side grace window
       * would close that.)
       */
      if (isRefreshRejected(error)) await clearSession();
      throw error;
    }

    /*
     * PERSIST BEFORE ADOPT, and the order is load-bearing.
     *
     * The server has already rotated: the old refresh token is dead the
     * instant that response returned. If the write failed and we adopted the
     * access token anyway, this tab would work until reload and then present
     * the dead token — which the server reads as reuse and answers by deleting
     * the session.
     *
     * setStoredRefreshToken throws on failure (unlike the read), so a failure
     * here reaches the catch above and clears the session rather than leaving
     * a booby-trapped one.
     */
    await setStoredRefreshToken(tokens.refreshToken);
    setAccessToken(tokens.accessToken, tokens.expiresIn);

    // Now other tabs can skip their own refresh entirely.
    getChannel()?.postMessage({
      type: 'tokens-updated',
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
    } satisfies TokenBroadcast);

    return true;
  });
}

/** Test-only: drops the broadcast channel and the fallback chain. */
export function resetRefreshCoordinatorForTests(): void {
  channel?.close();
  channel = null;
  fallbackChain = Promise.resolve();
}
