/** Tests for database. */
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';

import { db, NotareDatabase } from '@/features/notes/local/database';
import {
  createLocalNote,
  fromNoteResponse,
  fromNoteSummary,
} from '@/features/notes/local/noteMappers';
import type { NoteRow } from '@/features/notes/local/noteRow';
import type { OutboxRow } from '@/features/notes/local/outboxRow';
import { makeNote, makeNoteSummary } from '~/fixtures/notes';

beforeEach(async () => {
  await db.notes.clear();
  await db.meta.clear();
});

describe('the notes table', () => {
  it('stores a note created offline, with no server id', async () => {
    const row = createLocalNote(1, { content: 'written on a train' });
    await db.notes.put(row);

    const stored = await db.notes.get(row.localId);

    expect(stored?.serverId).toBeNull();
    expect(stored?.content).toBe('written on a train');
    expect(stored?.dirty).toBe(1);
  });

  it('refuses two rows claiming the same server note', async () => {
    const first = fromNoteResponse(makeNote({ id: 7 }));
    const second = fromNoteResponse(makeNote({ id: 7 }));

    await db.notes.put(first);

    await expect(db.notes.add(second)).rejects.toThrow();
  });

  it('allows many rows with no server id', async () => {
    await db.notes.bulkPut([createLocalNote(1), createLocalNote(1), createLocalNote(1)]);

    await expect(db.notes.count()).resolves.toBe(3);
  });

  it('queries the main list through the compound index', async () => {
    await db.notes.bulkPut([
      { ...createLocalNote(1, { content: 'visible' }), deleted: 0 },
      { ...createLocalNote(1, { content: 'trashed' }), deleted: 1 },
      { ...createLocalNote(2, { content: 'someone else' }), deleted: 0 },
    ]);

    const mine = await db.notes.where('[ownerId+deleted]').equals([1, 0]).toArray();

    expect(mine.map((row) => row.content)).toEqual(['visible']);
  });

  it('finds dirty rows for Step 8 to push', async () => {
    await db.notes.bulkPut([
      createLocalNote(1, { content: 'unsent' }),
      { ...fromNoteResponse(makeNote({ id: 3 })), dirty: 0 },
    ]);

    const pending = await db.notes.where('dirty').equals(1).toArray();

    expect(pending).toHaveLength(1);
    expect(pending[0]?.content).toBe('unsent');
  });
});

describe('mapping', () => {
  it('keeps local identity when a server response updates an existing row', async () => {
    const local = createLocalNote(1);
    await db.notes.put(local);

    const updated = fromNoteResponse(makeNote({ id: 9 }), local);

    expect(updated.localId).toBe(local.localId);
    expect(updated.clientId).toBe(local.clientId);
    expect(updated.serverId).toBe(9);
    expect(updated.dirty).toBe(0);
  });

  it('does not blank content when a list summary updates a row', () => {
    const existing = fromNoteResponse(
      makeNote({ id: 4, content: 'the whole note', pinned: false }),
    );
    const merged = fromNoteSummary(makeNoteSummary({ id: 4, pinned: true }), 1, existing);

    expect(merged.content).toBe('the whole note');
    expect(merged.pinned).toBe(1);
  });
});

describe('meta', () => {
  it('stores the sync cursor as an opaque value', async () => {
    await db.meta.put({ key: 'sync.cursor', value: '2026-08-08T10:15:30.123' });

    const stored = await db.meta.get('sync.cursor');
    expect(stored?.value).toBe('2026-08-08T10:15:30.123');
  });
});

describe('the version 1 -> 2 migration (8A)', () => {
  async function migrateFromV1(seedNotes: NoteRow[]): Promise<OutboxRow[]> {
    const name = `notare-migration-test-${crypto.randomUUID()}`;

    const v1Only = new Dexie(name);
    v1Only.version(1).stores({
      notes:
        'localId, &serverId, clientId, [ownerId+deleted+archived], dirty, syncState, localUpdatedAt, updatedAt',
      meta: 'key',
    });
    await v1Only.open();
    await v1Only.table('notes').bulkPut(seedNotes);
    v1Only.close();

    const migrated = new NotareDatabase(name);
    await migrated.open();
    try {
      return await migrated.outbox.orderBy('id').toArray();
    } finally {
      await migrated.delete();
    }
  }

  it('queues a CREATE for a note that has never reached the server', async () => {
    const offline = createLocalNote(1, { content: 'Written on a train' });

    const outbox = await migrateFromV1([offline]);

    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({
      type: 'CREATE',
      localId: offline.localId,
      clientId: offline.clientId,
      content: 'Written on a train',
      noteId: null,
    });
  });

  it('queues a DELETE for a note trashed offline', async () => {
    const trashed = {
      ...fromNoteResponse(makeNote({ id: 5 })),
      deleted: 1 as const,
      dirty: 1 as const,
    };

    const outbox = await migrateFromV1([trashed]);

    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({
      type: 'DELETE',
      localId: trashed.localId,
      noteId: 5,
      content: null,
    });
  });

  it('does NOT queue anything for a synced, non-deleted, dirty note — the genuinely ambiguous case', async () => {
    const ambiguous = { ...fromNoteResponse(makeNote({ id: 8 })), dirty: 1 as const };

    const outbox = await migrateFromV1([ambiguous]);

    expect(outbox).toHaveLength(0);
  });

  it('leaves a clean note alone entirely', async () => {
    const clean = { ...fromNoteResponse(makeNote({ id: 2 })), dirty: 0 as const };

    const outbox = await migrateFromV1([clean]);

    expect(outbox).toHaveLength(0);
  });

  it('preserves insertion order across mixed operations, since id IS the push order', async () => {
    const created = createLocalNote(1, { content: 'first, offline create' });
    const deleted = {
      ...fromNoteResponse(makeNote({ id: 6 })),
      deleted: 1 as const,
      dirty: 1 as const,
    };

    const outbox = await migrateFromV1([created, deleted]);

    expect(outbox.map((row) => row.type)).toEqual(['CREATE', 'DELETE']);
    expect(outbox[1]!.id).toBeGreaterThan(outbox[0]!.id!);
  });
});
