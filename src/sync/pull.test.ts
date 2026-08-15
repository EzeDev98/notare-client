import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/features/notes/local/database';
import { noteRepository, outboxRepository, metaRepository } from '@/features/notes/local/noteRepository';
import { pullChanges } from '@/sync/pull';
import { makeNote, makeRow } from '~/fixtures/notes';
import { server } from '~/msw/server';

const BASE = 'http://localhost:2001/api/v1';

beforeEach(async () => {
  await db.notes.clear();
  await db.meta.clear();
  await db.outbox.clear();
});

function pullOnce(page: {
  changed?: unknown[];
  deletedIds?: number[];
  nextCursor?: string;
  hasMore?: boolean;
}) {
  server.use(
    http.get(`${BASE}/sync`, () =>
      HttpResponse.json({
        changed: page.changed ?? [],
        deletedIds: page.deletedIds ?? [],
        nextCursor: page.nextCursor ?? '2026-08-13T09:00:00.000',
        hasMore: page.hasMore ?? false,
      }),
    ),
  );
}

describe('pullChanges — merging changed notes', () => {
  it('inserts a note with no local row', async () => {
    // The wrapper shape GET /sync actually sends — { note, clientId }, NOT
    // note fields spread flat with clientId alongside them. Getting this
    // fixture wrong is exactly what let the real bug (reconcile.ts reading
    // `note.id` off the wrapper instead of `.note.id`) ship unnoticed.
    pullOnce({ changed: [{ note: makeNote({ id: 7, version: 0 }), clientId: null }] });

    await pullChanges(1);

    const inserted = await noteRepository.getByServerId(7);
    expect(inserted).toBeDefined();
    expect(inserted?.dirty).toBe(0);
    expect(inserted?.syncState).toBe('synced');
    expect(inserted?.ownerId).toBe(1);
  });

  it('reuses the server-echoed clientId instead of minting a new local identity', async () => {
    pullOnce({
      changed: [{ note: makeNote({ id: 8, version: 0 }), clientId: 'client-offline-1' }],
    });

    await pullChanges(1);

    const inserted = await noteRepository.getByServerId(8);
    expect(inserted?.clientId).toBe('client-offline-1');
  });

  it('matches an offline-created row by clientId before it has a serverId', async () => {
    const row = makeRow({ serverId: null, localId: 'local-x', clientId: 'client-x', dirty: 0 });
    await noteRepository.put(row);

    pullOnce({
      changed: [{ note: makeNote({ id: 9, version: 0 }), clientId: 'client-x' }],
    });

    await pullChanges(1);

    const all = await db.notes.toArray();
    expect(all).toHaveLength(1);
    expect(all[0]?.localId).toBe('local-x');
    expect(all[0]?.serverId).toBe(9);
  });

  it('updates a clean row outright with the server copy', async () => {
    const row = makeRow({ serverId: 10, localId: 'local-10', dirty: 0, version: 0, title: 'Old' });
    await noteRepository.put(row);

    pullOnce({
      changed: [{ note: makeNote({ id: 10, version: 1, title: 'New' }), clientId: null }],
    });

    await pullChanges(1);

    const updated = await noteRepository.getByLocalId('local-10');
    expect(updated?.title).toBe('New');
    expect(updated?.version).toBe(1);
  });

  it('leaves a dirty row alone when the server version still matches its base', async () => {
    const row = makeRow({
      serverId: 11,
      localId: 'local-11',
      dirty: 1,
      syncState: 'pending',
      version: 0,
      title: 'My unsent edit',
    });
    await noteRepository.put(row);

    pullOnce({
      changed: [{ note: makeNote({ id: 11, version: 0, title: 'Same as before' }), clientId: null }],
    });

    await pullChanges(1);

    const untouched = await noteRepository.getByLocalId('local-11');
    expect(untouched?.title).toBe('My unsent edit');
    expect(untouched?.dirty).toBe(1);
    expect(untouched?.syncState).toBe('pending');
  });

  it('marks a conflict when a dirty row is based on a version the server has moved past', async () => {
    const row = makeRow({
      serverId: 12,
      localId: 'local-12',
      dirty: 1,
      version: 0,
      title: 'My unsent edit',
    });
    await noteRepository.put(row);

    const theirs = { note: makeNote({ id: 12, version: 3, title: 'Someone else edited' }), clientId: null };
    pullOnce({ changed: [theirs] });

    await pullChanges(1);

    const conflicted = await noteRepository.getByLocalId('local-12');
    expect(conflicted?.syncState).toBe('conflict');
    expect(conflicted?.title).toBe('My unsent edit');
    expect(conflicted?.dirty).toBe(1);
    expect(conflicted?.conflictNote?.title).toBe('Someone else edited');
  });
});

describe('pullChanges — tombstones', () => {
  it('evicts a permanently-deleted note and any outbox row for it', async () => {
    const row = makeRow({ serverId: 20, localId: 'local-20', dirty: 1 });
    await noteRepository.put(row);
    await outboxRepository.enqueueUpdate({
      localId: row.localId,
      noteId: 20,
      version: 0,
      title: row.title,
      content: row.content,
    });

    pullOnce({ deletedIds: [20] });

    await pullChanges(1);

    await expect(noteRepository.getByServerId(20)).resolves.toBeUndefined();
    await expect(outboxRepository.count()).resolves.toBe(0);
  });

  it('is a no-op for a tombstone id with no local row', async () => {
    pullOnce({ deletedIds: [999] });

    await expect(pullChanges(1)).resolves.toBeUndefined();
  });
});

describe('pullChanges — cursor discipline', () => {
  it('does not advance the cursor until hasMore is false, and pages with the same since', async () => {
    let requestCount = 0;
    const seenSince: (string | null)[] = [];
    const seenPages: string[] = [];

    server.use(
      http.get(`${BASE}/sync`, ({ request }) => {
        const url = new URL(request.url);
        seenSince.push(url.searchParams.get('since'));
        seenPages.push(url.searchParams.get('page') ?? '');
        requestCount += 1;

        if (requestCount === 1) {
          return HttpResponse.json({
            changed: [],
            deletedIds: [],
            nextCursor: 'CURSOR-A',
            hasMore: true,
          });
        }

        return HttpResponse.json({
          changed: [],
          deletedIds: [],
          nextCursor: 'CURSOR-B',
          hasMore: false,
        });
      }),
    );

    await pullChanges(1);

    expect(seenPages).toEqual(['0', '1']);
    // Both requests carried the SAME since (undefined here, a first sync) —
    // the loop must never advance the cursor mid-page.
    expect(seenSince).toEqual([null, null]);
    await expect(metaRepository.getSyncCursor()).resolves.toBe('CURSOR-B');
  });

  it('stops without writing the cursor when the connection is genuinely gone', async () => {
    server.use(http.get(`${BASE}/sync`, () => HttpResponse.error()));

    await expect(pullChanges(1)).resolves.toBeUndefined();
    await expect(metaRepository.getSyncCursor()).resolves.toBeUndefined();
  });
});

describe('pullChanges — reentrancy', () => {
  it('two concurrent calls share one run rather than racing the cursor', async () => {
    let requestCount = 0;
    server.use(
      http.get(`${BASE}/sync`, () => {
        requestCount += 1;
        return HttpResponse.json({
          changed: [],
          deletedIds: [],
          nextCursor: 'CURSOR-ONCE',
          hasMore: false,
        });
      }),
    );

    await Promise.all([pullChanges(1), pullChanges(1)]);

    expect(requestCount).toBe(1);
  });
});
