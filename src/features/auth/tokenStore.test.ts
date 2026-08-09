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
    // The startup case: no token is indistinguishable from an expired one for
    // the purpose of "should we refresh before sending this request".
    expect(isAccessTokenExpiring()).toBe(true);
  });

  it('is not expiring while it has comfortable life left', () => {
    setAccessToken('access-abc', 900_000);
    expect(isAccessTokenExpiring()).toBe(false);
  });

  it('reports expiring inside the skew window', () => {
    /*
     * A token with 10s left is a 401 waiting to happen: the skew absorbs clock
     * drift between browser and server plus the time a request spends in
     * flight. 4D refreshes proactively rather than reacting to a 401, which on
     * this server also means fewer chances for two requests to race into two
     * refreshes.
     */
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
    // Rotation replaces the value on every refresh. Two tokens coexisting
    // would mean a later read could return the dead one — and presenting a
    // dead token is what deletes the session server-side.
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
    /*
     * The property 4D depends on: IndexedDB is per-origin, not per-tab, so a
     * token written by one tab is visible to another. sessionStorage would
     * have failed this and taken cross-tab coordination with it.
     */
    await setStoredRefreshToken('shared');
    resetTokenStoreForTests(); // simulates a second tab opening its own connection

    await expect(getStoredRefreshToken()).resolves.toBe('shared');
  });
});
