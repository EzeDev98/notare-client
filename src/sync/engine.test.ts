import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * push.ts/pull.ts are MOCKED, not exercised for real. This file tests
 * SCHEDULING — when a run happens, how backoff behaves, what the lock does —
 * none of which needs a real Dexie transaction or a real HTTP round trip.
 * Running the genuine stack here would mean fake timers, fake-indexeddb, and
 * MSW all fighting for the same event loop, which is a real and separate
 * problem from anything this file is meant to verify. push.test.ts and
 * pull.test.ts already cover what those two functions do; this file only
 * needs to know THAT the engine calls them, in what order, and how it reacts
 * to what they report back.
 */
vi.mock('@/sync/push', () => ({ pushOutbox: vi.fn(() => Promise.resolve()) }));
vi.mock('@/sync/pull', () => ({ pullChanges: vi.fn(() => Promise.resolve()) }));
// The engine also awaits these. They touch real IndexedDB, which fake timers starve,
// and they are not what this file tests.
vi.mock('@/sync/clipUpload', () => ({ uploadPendingClips: vi.fn(() => Promise.resolve()) }));
vi.mock('@/sync/releaseLegacyConflicts', () => ({
  releaseLegacyConflicts: vi.fn(() => Promise.resolve()),
}));
vi.mock('@/features/notes/local/housekeeping', () => ({
  purgeExpiredTrash: vi.fn(() => Promise.resolve()),
}));

import { pullChanges } from '@/sync/pull';
import { pushOutbox } from '@/sync/push';
import { requestSync, resetSyncEngineForTests, start } from '@/sync/engine';
import { getSyncStatus, resetSyncStatusForTests } from '@/sync/syncStatus';
import { markTransportFailure } from '@/sync/transportFailure';

const mockPush = vi.mocked(pushOutbox);
const mockPull = vi.mocked(pullChanges);

function setOnline(value: boolean): void {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
}

function setVisibility(value: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { value, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

let stop: (() => void) | null = null;

beforeEach(() => {
  resetSyncEngineForTests();
  resetSyncStatusForTests();
  setOnline(true);
  setVisibility('visible');
  mockPush.mockReset().mockResolvedValue(undefined);
  mockPull.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  stop?.();
  stop = null;
  vi.useRealTimers();
});

describe('start', () => {
  it('runs push then pull, in that order, on mount', async () => {
    stop = start(1);
    await vi.waitFor(() => expect(getSyncStatus().status).toBe('idle'));

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPull).toHaveBeenCalledTimes(1);
    expect(mockPush.mock.invocationCallOrder[0]).toBeLessThan(
      mockPull.mock.invocationCallOrder[0]!,
    );
    expect(getSyncStatus().lastSyncedAt).not.toBeNull();
  });

  it('does nothing for a null owner', async () => {
    stop = start(null);
    await Promise.resolve();

    expect(mockPush).not.toHaveBeenCalled();
    expect(getSyncStatus().lastSyncedAt).toBeNull();
  });

  it('passes ownerId through to pullChanges', async () => {
    stop = start(42);
    await vi.waitFor(() => expect(mockPull).toHaveBeenCalledWith(42));
  });

  it('re-runs on the online event', async () => {
    stop = start(1);
    await vi.waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1));

    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(mockPush).toHaveBeenCalledTimes(2));
  });

  it('re-runs when the tab becomes visible again', async () => {
    stop = start(1);
    await vi.waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1));

    setVisibility('hidden');
    setVisibility('visible');
    await vi.waitFor(() => expect(mockPush).toHaveBeenCalledTimes(2));
  });

  it('re-runs on a debounced local mutation, coalescing bursts into one run', async () => {
    vi.useFakeTimers();
    stop = start(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(mockPush).toHaveBeenCalledTimes(1);

    const { notifyLocalMutation } = await import('@/sync/mutationSignal');
    notifyLocalMutation();
    await vi.advanceTimersByTimeAsync(500);
    notifyLocalMutation(); // a second edit inside the debounce window
    await vi.advanceTimersByTimeAsync(1_999);
    expect(mockPush).toHaveBeenCalledTimes(1); // still debouncing

    await vi.advanceTimersByTimeAsync(1);
    expect(mockPush).toHaveBeenCalledTimes(2); // exactly one run for both edits
  });

  it('does not poll: with nothing happening, no run starts on a timer alone', async () => {
    vi.useFakeTimers();
    stop = start(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(mockPush).toHaveBeenCalledTimes(1);

    // Sync is event-driven (start, online, visible, local change). Minutes pass, nothing runs.
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it('short-circuits to offline without even trying when navigator.onLine is false', async () => {
    setOnline(false);
    stop = start(1);
    await vi.waitFor(() => expect(getSyncStatus().status).toBe('offline'));
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe('backoff', () => {
  it('retries after a transport failure, then resets once a run is clean', async () => {
    vi.useFakeTimers();
    mockPull.mockImplementationOnce(() => {
      markTransportFailure();
      return Promise.resolve();
    });

    stop = start(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(mockPull).toHaveBeenCalledTimes(1);
    expect(getSyncStatus().status).toBe('offline');

    // First backoff step is 5s.
    await vi.advanceTimersByTimeAsync(4_999);
    expect(mockPull).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(mockPull).toHaveBeenCalledTimes(2);
    expect(getSyncStatus().status).toBe('idle');
  });

  it('lengthens the delay on consecutive failures, capped at the steady-state interval', async () => {
    vi.useFakeTimers();
    mockPull.mockImplementation(() => {
      markTransportFailure();
      return Promise.resolve();
    });

    stop = start(1);
    await vi.advanceTimersByTimeAsync(0); // attempt 1, fails
    await vi.advanceTimersByTimeAsync(5_000); // attempt 2, fails (5s step)
    expect(mockPull).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(14_999);
    expect(mockPull).toHaveBeenCalledTimes(2); // not yet — second step is 15s
    await vi.advanceTimersByTimeAsync(1);
    expect(mockPull).toHaveBeenCalledTimes(3);
  });

  it('surfaces an unrecognised, non-offline error as a visible error state', async () => {
    vi.useFakeTimers();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockPull.mockRejectedValueOnce(new Error('unexpected shape from GET /sync'));

    stop = start(1);
    await vi.advanceTimersByTimeAsync(0);

    expect(getSyncStatus().status).toBe('error');
    expect(getSyncStatus().lastError).toBe('unexpected shape from GET /sync');
    consoleError.mockRestore();
  });
});

describe('cross-tab lock', () => {
  it('skips a run when another tab already holds the lock', async () => {
    const fakeLocks = {
      request: (_name: string, _opts: unknown, callback: (lock: null) => unknown) =>
        Promise.resolve(callback(null)),
    };
    Object.defineProperty(navigator, 'locks', { value: fakeLocks, configurable: true });

    stop = start(1);
    await Promise.resolve();
    await Promise.resolve();

    expect(mockPush).not.toHaveBeenCalled();
    expect(mockPull).not.toHaveBeenCalled();
    expect(getSyncStatus().lastSyncedAt).toBeNull();

    // @ts-expect-error -- test-only cleanup of the fake installed above
    delete navigator.locks;
  });
});

describe('requestSync', () => {
  it('coalesces calls arriving while a run is already in flight', async () => {
    let resolvePush!: () => void;
    mockPush.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolvePush = resolve;
      }),
    );

    stop = start(1);
    const second = requestSync('duplicate');
    resolvePush();
    await second;

    // Both callers got the SAME run — one push, not two.
    expect(mockPush).toHaveBeenCalledTimes(1);
  });
});
