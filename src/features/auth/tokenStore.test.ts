/** Tests for tokenStore. */
import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearSession,
  getAccessToken,
  getStoredRefreshToken,
  isAccessTokenExpiring,
  resetTokenStoreForTests,
  setAccessToken,
  setStoredRefreshToken,
} from '@/features/auth/tokenStore';

beforeEach(async () => {
  resetTokenStoreForTests();
  await clearSession();
});

describe('access token', () => {
  it('is held in memory and readable back', () => {
    setAccessToken('access-abc', 900_000);
    expect(getAccessToken()).toBe('access-abc');
  });

  it('reports expiring when there is no token at all', () => {
    expect(isAccessTokenExpiring()).toBe(true);
  });

  it('is not expiring while it has comfortable life left', () => {
    setAccessToken('access-abc', 900_000);
    expect(isAccessTokenExpiring()).toBe(false);
  });

  it('reports expiring inside the skew window', () => {
    setAccessToken('access-abc', 10_000);
    expect(isAccessTokenExpiring(30_000)).toBe(true);
  });
});

describe('refresh token', () => {
  it('round-trips through IndexedDB', async () => {
    await setStoredRefreshToken('refresh-xyz');
    await expect(getStoredRefreshToken()).resolves.toBe('refresh-xyz');
  });

  it('returns null when nothing is stored', async () => {
    await expect(getStoredRefreshToken()).resolves.toBeNull();
  });

  it('overwrites rather than accumulating', async () => {
    await setStoredRefreshToken('first');
    await setStoredRefreshToken('second');

    await expect(getStoredRefreshToken()).resolves.toBe('second');
  });

  it('clears both tokens on clearSession', async () => {
    setAccessToken('access-abc', 900_000);
    await setStoredRefreshToken('refresh-xyz');

    await clearSession();

    expect(getAccessToken()).toBeNull();
    await expect(getStoredRefreshToken()).resolves.toBeNull();
  });

  it('shares stored state across independent reads, as two tabs would', async () => {
    await setStoredRefreshToken('shared');
    resetTokenStoreForTests();

    await expect(getStoredRefreshToken()).resolves.toBe('shared');
  });
});
