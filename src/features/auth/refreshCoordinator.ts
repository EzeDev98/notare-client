/** Refreshes the access token, once at a time across tabs. */
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

const LOCK_NAME = 'notare.auth.refresh';
const CHANNEL_NAME = 'notare.auth';

interface TokenBroadcast {
  type: 'tokens-updated';
  accessToken: string;
  expiresIn: number;
}

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  channel ??= new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

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

let fallbackChain: Promise<unknown> = Promise.resolve();

function withLock<T>(critical: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && 'locks' in navigator) {
    return navigator.locks.request(LOCK_NAME, critical);
  }

  const result = fallbackChain.then(critical);
  fallbackChain = result.catch(() => undefined);
  return result;
}

export interface EnsureOptions {
  staleAccessToken?: string | null;
}

export function isRefreshRejected(error: unknown): boolean {
  const status = statusOf(error);
  return status === 400 || status === 401 || status === 403;
}

export function ensureFreshAccessToken(options: EnsureOptions = {}): Promise<boolean> {
  return withLock(async () => {
    if (options.staleAccessToken !== undefined) {
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
      if (isRefreshRejected(error)) await clearSession();
      throw error;
    }

    await setStoredRefreshToken(tokens.refreshToken);
    setAccessToken(tokens.accessToken, tokens.expiresIn);

    getChannel()?.postMessage({
      type: 'tokens-updated',
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
    } satisfies TokenBroadcast);

    return true;
  });
}

export function resetRefreshCoordinatorForTests(): void {
  channel?.close();
  channel = null;
  fallbackChain = Promise.resolve();
}
