import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/features/notes/local/database';
import { noteRepository, outboxRepository } from '@/features/notes/local/noteRepository';
import { pushOutbox } from '@/sync/push';
import { makeNote, makeRow } from '~/fixtures/notes';
import { server } from '~/msw/server';

const BASE = 'http://localhost:2001/api/v1';

beforeEach(async () => {
  await db.notes.clear();
  await db.meta.clear();
  await db.outbox.clear();
});

describe('pushOutbox — APPLIED', () => {
  it('adopts the server id and version for an applied CREATE, and clears the outbox row', async () => {
    const row = makeRow({ serverId: null, localId: 'local-1', clientId: 'client-1', dirty: 1 });
    await noteRepository.put(row);
    await outboxRepository.enqueueCreate({
      localId: row.localId,
      clientId: row.clientId,
      title: row.title,
      content: row.content,
    });

    server.use(
      http.post(`${BASE}/sync/batch`, async ({ request }) => {
        const body = (await request.json()) as { operations: { operationId: string }[] };
        const operationId = body.operations[0]?.operationId;
        return HttpResponse.json({
          results: [
            {
              operationId,
              status: 'APPLIED',
              note: makeNote({ id: 42, version: 0 }),
            },
          ],
          appliedCount: 1,
          conflictCount: 0,
          serverTime: '2026-08-13T09:00:00.000',
        });
      }),
    );

    await pushOutbox();

    const updated = await noteRepository.getByLocalId('local-1');
    expect(updated?.serverId).toBe(42);
    expect(updated?.dirty).toBe(0);
    expect(updated?.syncState).toBe('synced');
    await expect(outboxRepository.count()).resolves.toBe(0);
  });

  it('applies a DELETE with no note payload, without touching a version', async () => {
    const row = makeRow({ serverId: 9, localId: 'local-2', deleted: 1, dirty: 1 });
    await noteRepository.put(row);
    await outboxRepository.enqueueDelete({ localId: row.localId, noteId: 9 });

    server.use(
      http.post(`${BASE}/sync/batch`, async ({ request }) => {
        const body = (await request.json()) as { operations: { operationId: string }[] };
        return HttpResponse.json({
          results: [{ operationId: body.operations[0]?.operationId, status: 'APPLIED' }],
          appliedCount: 1,
          conflictCount: 0,
          serverTime: '2026-08-13T09:00:00.000',
        });
      }),
    );

    await pushOutbox();

    const updated = await noteRepository.getByLocalId('local-2');
    expect(updated?.dirty).toBe(0);
    expect(updated?.syncState).toBe('synced');
    await expect(outboxRepository.count()).resolves.toBe(0);
  });
});

describe('pushOutbox — CONFLICT', () => {
  it('keeps the local copy, attaches the server note, and leaves the outbox row queued', async () => {
    // A realistic prior state: applyLocalEdit already wrote the edit to the
    // note row itself, and a failed save attempt queued the same content in
    // the outbox afterwards — enqueueUpdate never touches the note row, only
    // the outbox, so the row must be seeded with the edit directly.
    const row = makeRow({
      serverId: 7,
      localId: 'local-3',
      version: 4,
      dirty: 1,
      content: 'edited offline',
    });
    await noteRepository.put(row);
    await outboxRepository.enqueueUpdate({
      localId: row.localId,
      noteId: 7,
      version: 4,
      title: row.title,
      content: row.content,
    });

    const theirs = makeNote({ id: 7, version: 6, title: 'edited elsewhere' });
    server.use(
      http.post(`${BASE}/sync/batch`, async ({ request }) => {
        const body = (await request.json()) as { operations: { operationId: string }[] };
        return HttpResponse.json({
          results: [
            { operationId: body.operations[0]?.operationId, status: 'CONFLICT', note: theirs },
          ],
          appliedCount: 0,
          conflictCount: 1,
          serverTime: '2026-08-13T09:00:00.000',
        });
      }),
    );

    await pushOutbox();

    const updated = await noteRepository.getByLocalId('local-3');
    expect(updated?.syncState).toBe('conflict');
    expect(updated?.conflictNote).toEqual(theirs);
    expect(updated?.content).toBe('edited offline'); // the local copy, untouched
    await expect(outboxRepository.count()).resolves.toBe(1);
  });

  it('does not resend an already-conflicted row on a later run', async () => {
    const row = makeRow({ serverId: 7, localId: 'local-4', syncState: 'conflict' });
    await noteRepository.put(row);
    await outboxRepository.enqueueUpdate({
      localId: row.localId,
      noteId: 7,
      version: 4,
      title: row.title,
      content: 'still queued',
    });

    let calls = 0;
    server.use(
      http.post(`${BASE}/sync/batch`, () => {
        calls += 1;
        return HttpResponse.json({
          results: [],
          appliedCount: 0,
          conflictCount: 0,
          serverTime: '2026-08-13T09:00:00.000',
        });
      }),
    );

    await pushOutbox();

    expect(calls).toBe(0);
    await expect(outboxRepository.count()).resolves.toBe(1);
  });
});

describe('pushOutbox — NOT_FOUND', () => {
  it('drops the operation and evicts the local note', async () => {
    const row = makeRow({ serverId: 11, localId: 'local-5', deleted: 1, dirty: 1 });
    await noteRepository.put(row);
    await outboxRepository.enqueueDelete({ localId: row.localId, noteId: 11 });

    server.use(
      http.post(`${BASE}/sync/batch`, async ({ request }) => {
        const body = (await request.json()) as { operations: { operationId: string }[] };
        return HttpResponse.json({
          results: [{ operationId: body.operations[0]?.operationId, status: 'NOT_FOUND' }],
          appliedCount: 0,
          conflictCount: 0,
          serverTime: '2026-08-13T09:00:00.000',
        });
      }),
    );

    await pushOutbox();

    await expect(noteRepository.getByLocalId('local-5')).resolves.toBeUndefined();
    await expect(outboxRepository.count()).resolves.toBe(0);
  });
});

describe('pushOutbox — INVALID', () => {
  it('quarantines the operation without touching the note\u2019s text', async () => {
    const row = makeRow({
      serverId: 3,
      localId: 'local-6',
      title: 'Keep me',
      content: 'never discard this',
      dirty: 1,
    });
    await noteRepository.put(row);
    await outboxRepository.enqueueUpdate({
      localId: row.localId,
      noteId: 3,
      version: 0,
      title: 'Keep me',
      content: 'never discard this',
    });

    server.use(
      http.post(`${BASE}/sync/batch`, async ({ request }) => {
        const body = (await request.json()) as { operations: { operationId: string }[] };
        return HttpResponse.json({
          results: [
            {
              operationId: body.operations[0]?.operationId,
              status: 'INVALID',
              message: 'title too long',
            },
          ],
          appliedCount: 0,
          conflictCount: 0,
          serverTime: '2026-08-13T09:00:00.000',
        });
      }),
    );

    await pushOutbox();

    const updated = await noteRepository.getByLocalId('local-6');
    expect(updated?.syncState).toBe('invalid');
    expect(updated?.title).toBe('Keep me');
    expect(updated?.content).toBe('never discard this');
    expect(updated?.dirty).toBe(1); // still shown as Unsaved, not silently clean
    await expect(outboxRepository.count()).resolves.toBe(0); // not retried
  });
});

describe('pushOutbox — transport failure', () => {
  it('leaves the outbox untouched when the batch request fails outright', async () => {
    const row = makeRow({ serverId: null, localId: 'local-7', clientId: 'client-7', dirty: 1 });
    await noteRepository.put(row);
    await outboxRepository.enqueueCreate({
      localId: row.localId,
      clientId: row.clientId,
      title: row.title,
      content: row.content,
    });

    server.use(http.post(`${BASE}/sync/batch`, () => HttpResponse.error()));

    await pushOutbox();

    await expect(outboxRepository.count()).resolves.toBe(1);
    const stillDirty = await noteRepository.getByLocalId('local-7');
    expect(stillDirty?.dirty).toBe(1);
  });
});

describe('pushOutbox — empty outbox', () => {
  it('makes no request at all', async () => {
    let calls = 0;
    server.use(
      http.post(`${BASE}/sync/batch`, () => {
        calls += 1;
        return HttpResponse.json({
          results: [],
          appliedCount: 0,
          conflictCount: 0,
          serverTime: '2026-08-13T09:00:00.000',
        });
      }),
    );

    await pushOutbox();

    expect(calls).toBe(0);
  });
});
