import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '@/features/notes/local/database';
import { noteRepository, outboxRepository } from '@/features/notes/local/noteRepository';
import { makeRow } from '~/fixtures/notes';

vi.mock('@/sync/engine', () => ({
  requestSync: vi.fn().mockResolvedValue(undefined),
}));

// Imported AFTER the mock is declared, same convention every other
// vi.mock-using test file in this repo follows — the mock factory above
// must be hoisted before this import resolves the real module graph.
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
  /*
   * wipeLocalState() closes the shared `db` singleton on purpose (see its
   * own doc comment on why — a delete request left blocked by this tab's
   * own open connection would never actually complete). In production that
   * is fine because a hard navigation follows immediately; here, this same
   * `db` instance is reused by every OTHER test file's afterEach
   * (tests/harness.tsx's resetDatabase()), so it has to come back for the
   * rest of this suite to keep working rather than throwing
   * DatabaseClosedError on the very next test.
   */
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
      // @ts-expect-error test-only cleanup of a property this test defined
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
    // The auth database is a separate module (tokenStore.ts) this test has
    // no reason to import — opening it directly by name is enough to prove
    // it existed before the wipe and is gone after.
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
