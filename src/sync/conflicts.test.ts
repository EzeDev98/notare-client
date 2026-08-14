import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/features/notes/local/database';
import { noteRepository, outboxRepository } from '@/features/notes/local/noteRepository';
import { resolveKeepBoth, resolveKeepMine, resolveUseTheirs } from '@/sync/conflicts';
import { makeNote, makeRow } from '~/fixtures/notes';
import { server } from '~/msw/server';

const BASE = 'http://localhost:2001/api/v1';

beforeEach(async () => {
  await db.notes.clear();
  await db.meta.clear();
  await db.outbox.clear();
});

function acceptAnyPush() {
  server.use(
    http.post(`${BASE}/sync/batch`, async ({ request }) => {
      const body = (await request.json()) as { operations: { operationId: string }[] };
      return HttpResponse.json({
        results: body.operations.map((op) => ({
          operationId: op.operationId,
          status: 'APPLIED',
          note: makeNote({ id: 900, version: 9 }),
        })),
        appliedCount: body.operations.length,
        conflictCount: 0,
        serverTime: '2026-08-13T09:00:00.000',
      });
    }),
  );
}

describe('resolveKeepMine', () => {
  it('adopts the server version, clears the conflict, and requeues the row for push', async () => {
    const theirs = makeNote({ id: 30, version: 5, title: 'Server title', content: 'Server body' });
    const row = makeRow({
      serverId: 30,
      localId: 'local-30',
      dirty: 1,
      version: 3,
      title: 'My title',
      content: 'My body',
      syncState: 'conflict',
      conflictNote: theirs,
    });
    await noteRepository.put(row);
    acceptAnyPush();

    await resolveKeepMine('local-30');

    const resolved = await noteRepository.getByLocalId('local-30');
    expect(resolved?.title).toBe('My title');
    /*
     * NOT theirs.version (5). resolveKeepMine sets that as an intermediate
     * step so the requeued push isn't stale against it, but requeue() awaits
     * pushOutbox() immediately — by the time this line runs, the push has
     * already completed and applyServerAck has adopted whatever version the
     * (mocked) server actually returned, which acceptAnyPush() fixes at 9.
     * Asserting 5 here would be checking a value this row held only for the
     * instant between two awaits inside resolveKeepMine, never once it returns.
     */
    expect(resolved?.version).toBe(9);
    expect(resolved?.conflictNote).toBeNull();
    // Requeued and immediately pushed by the APPLIED handler above, so the
    // outbox should have drained rather than sitting on the row we queued.
    await expect(outboxRepository.count()).resolves.toBe(0);
  });

  it('throws rather than silently no-op when called on a row with no conflict', async () => {
    const row = makeRow({ localId: 'local-31', syncState: 'synced', conflictNote: null });
    await noteRepository.put(row);

    await expect(resolveKeepMine('local-31')).rejects.toThrow();
  });
});

describe('resolveUseTheirs', () => {
  it('replaces the row with the server copy and drops anything queued for it', async () => {
    const theirs = makeNote({ id: 40, version: 7, title: 'Server title', content: 'Server body' });
    const row = makeRow({
      serverId: 40,
      localId: 'local-40',
      dirty: 1,
      version: 3,
      title: 'My title',
      content: 'My body',
      syncState: 'conflict',
      conflictNote: theirs,
    });
    await noteRepository.put(row);
    await outboxRepository.enqueueUpdate({
      localId: 'local-40',
      noteId: 40,
      version: 3,
      title: 'My title',
      content: 'My body',
    });

    await resolveUseTheirs('local-40');

    const resolved = await noteRepository.getByLocalId('local-40');
    expect(resolved?.title).toBe('Server title');
    expect(resolved?.dirty).toBe(0);
    expect(resolved?.syncState).toBe('synced');
    expect(resolved?.conflictNote).toBeNull();
    await expect(outboxRepository.count()).resolves.toBe(0);
  });
});

describe('resolveKeepBoth', () => {
  it('puts theirs first, a divider, then mine, and requeues the merged row', async () => {
    const theirs = makeNote({
      id: 50,
      version: 2,
      title: 'Server title',
      content: 'Server body',
    });
    const row = makeRow({
      serverId: 50,
      localId: 'local-50',
      dirty: 1,
      version: 1,
      title: 'My title',
      content: 'My body',
      syncState: 'conflict',
      conflictNote: theirs,
    });
    await noteRepository.put(row);
    acceptAnyPush();

    await resolveKeepBoth('local-50');

    const resolved = await noteRepository.getByLocalId('local-50');
    expect(resolved?.content).toBe('Server body\n\n--- Your version ---\n\nMy body');
    expect(resolved?.title).toBe('Server title / My title');
    // Same reasoning as resolveKeepMine's test: requeue() awaits the push,
    // and acceptAnyPush() fixes the applied version at 9 regardless of what
    // was sent — not theirs.version (2), which is only an intermediate value.
    expect(resolved?.version).toBe(9);
    expect(resolved?.conflictNote).toBeNull();
  });

  it('keeps mine outright when their content is blank', async () => {
    const theirs = makeNote({ id: 51, version: 2, title: '', content: '' });
    const row = makeRow({
      serverId: 51,
      localId: 'local-51',
      dirty: 1,
      version: 1,
      title: 'My title',
      content: 'My body',
      syncState: 'conflict',
      conflictNote: theirs,
    });
    await noteRepository.put(row);
    acceptAnyPush();

    await resolveKeepBoth('local-51');

    const resolved = await noteRepository.getByLocalId('local-51');
    expect(resolved?.content).toBe('My body');
    expect(resolved?.title).toBe('My title');
  });
});
