/** Tests for hardReset. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '@/features/notes/local/database';
import { noteRepository, outboxRepository } from '@/features/notes/local/noteRepository';
import { makeRow } from '~/fixtures/notes';

vi.mock('@/sync/engine', () => ({
  requestSync: vi.fn().mockResolvedValue(undefined),
}));

import { requestSync } from '@/sync/engine';
import { attemptFinalSync, wipeLocalState } from '@/app/hardReset';

describe('attemptFinalSync', () => {
  beforeEach(() => {
    vi.mocked(requestSync).mockClear();
  });

  it('runs the sync engine once for a signed-in owner', async () => {
    await attemptFinalSync(1);
    expect(requestSync).toHaveBeenCalledWith('manual-reset');
  });

  it('skips the sync engine entirely when there is no owner to sync for', async () => {
    await attemptFinalSync(null);
    expect(requestSync).not.toHaveBeenCalled();
  });

  it('reports no unsynced changes when the outbox and every note are clean', async () => {
    const result = await attemptFinalSync(1);
    expect(result.hadUnsyncedChanges).toBe(false);
  });

  it('reports unsynced changes when a note is still dirty', async () => {
    await noteRepository.put(makeRow({ localId: 'local-dirty', dirty: 1 }));

    const result = await attemptFinalSync(1);
    expect(result.hadUnsyncedChanges).toBe(true);
  });

  it('reports unsynced changes when the outbox still holds a queued operation', async () => {
    await outboxRepository.enqueueCreate({
      localId: 'local-queued',
      clientId: 'client-queued',
      content: 'still queued',
    });

    const result = await attemptFinalSync(1);
    expect(result.hadUnsyncedChanges).toBe(true);
  });

  it('still reports unsynced changes if the sync engine itself throws', async () => {
    vi.mocked(requestSync).mockRejectedValueOnce(new Error('offline'));
    await noteRepository.put(makeRow({ localId: 'local-dirty-2', dirty: 1 }));

    const result = await attemptFinalSync(1);
    expect(result.hadUnsyncedChanges).toBe(true);
  });
});

describe('wipeLocalState', () => {
  afterEach(async () => {
    await db.open().catch(() => undefined);
  });

  it('unregisters every service worker registration', async () => {
    const unregisterA = vi.fn().mockResolvedValue(true);
    const unregisterB = vi.fn().mockResolvedValue(true);

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistrations: vi
          .fn()
          .mockResolvedValue([{ unregister: unregisterA }, { unregister: unregisterB }]),
      },
    });

    try {
      await wipeLocalState();
    } finally {
      // @ts-expect-error -- test-only cleanup
      delete navigator.serviceWorker;
    }

    expect(unregisterA).toHaveBeenCalled();
    expect(unregisterB).toHaveBeenCalled();
  });

  it('deletes every Cache Storage entry', async () => {
    const deleteCache = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('caches', {
      keys: vi.fn().mockResolvedValue(['notare-shell-v1', 'notare-runtime-v1']),
      delete: deleteCache,
    });

    try {
      await wipeLocalState();
    } finally {
      vi.unstubAllGlobals();
    }

    expect(deleteCache).toHaveBeenCalledWith('notare-shell-v1');
    expect(deleteCache).toHaveBeenCalledWith('notare-runtime-v1');
  });

  it('deletes both the notes database and the auth database', async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('notare-auth', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('session');
      };
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
      request.onerror = () => reject(request.error ?? new Error('Failed to open notare-auth.'));
    });

    await noteRepository.put(makeRow({ localId: 'local-before-wipe' }));

    await wipeLocalState();

    const names = (await indexedDB.databases()).map((entry) => entry.name);
    expect(names).not.toContain(db.name);
    expect(names).not.toContain('notare-auth');
  });

  it('clears both Web Storage areas', async () => {
    localStorage.setItem('some-key', 'some-value');
    sessionStorage.setItem('other-key', 'other-value');

    await wipeLocalState();

    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});
