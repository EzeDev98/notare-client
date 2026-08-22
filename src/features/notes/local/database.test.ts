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

    /*
     * The reason localId is the primary key: IndexedDB rejects a null key
     * outright, and an identity that only appears after a round trip is not an
     * identity — the editor and Step 8's outbox both reference this note long
     * before any server has seen it.
     */
    expect(stored?.serverId).toBeNull();
    expect(stored?.content).toBe('written on a train');
    expect(stored?.dirty).toBe(1);
  });

  it('refuses two rows claiming the same server note', async () => {
    const first = fromNoteResponse(makeNote({ id: 7 }));
    const second = fromNoteResponse(makeNote({ id: 7 }));

    await db.notes.put(first);

    // &serverId is unique. Without it, a pull racing a create could leave the
    // same note in the database twice.
    await expect(db.notes.add(second)).rejects.toThrow();
  });

  it('allows many rows with no server id', async () => {
    // Unique indexes in IndexedDB permit multiple nulls — which is exactly
    // what several offline-created notes need.
    await db.notes.bulkPut([createLocalNote(1), createLocalNote(1), createLocalNote(1)]);

    await expect(db.notes.count()).resolves.toBe(3);
  });

  it('queries the main list through the compound index', async () => {
    await db.notes.bulkPut([
      { ...createLocalNote(1, { content: 'visible' }), deleted: 0, archived: 0 },
      { ...createLocalNote(1, { content: 'archived' }), deleted: 0, archived: 1 },
      { ...createLocalNote(1, { content: 'trashed' }), deleted: 1, archived: 0 },
      { ...createLocalNote(2, { content: 'someone else' }), deleted: 0, archived: 0 },
    ]);

    const mine = await db.notes.where('[ownerId+deleted+archived]').equals([1, 0, 0]).toArray();

    /*
     * One row: mine, not deleted, not archived.
     *
     * This expected [] until the flags became 0 | 1 — IndexedDB cannot index
     * booleans, so the compound query matched nothing at all. No error, an
     * empty list, and a notes screen permanently blank while the data sat in
     * the database. The compiler could not catch it either: `boolean` is a
     * perfectly valid TypeScript type for a field IndexedDB will quietly
     * refuse to index.
     */
    expect(mine.map((row) => row.content)).toEqual(['visible']);
  });

  it('finds dirty rows for Step 8 to push', async () => {
    await db.notes.bulkPut([
      createLocalNote(1, { content: 'unsent' }),
      { ...fromNoteResponse(makeNote({ id: 3 })), dirty: 0 },
    ]);

    const pending = await db.notes.where('dirty').equals(1).toArray();

    /*
     * dirty is 0/1 rather than a boolean because IndexedDB CANNOT INDEX
     * BOOLEANS. where('dirty').equals(true) matches nothing — no error, an
     * empty result, and a sync engine that silently never pushes.
     */
    expect(pending).toHaveLength(1);
    expect(pending[0]?.content).toBe('unsent');
  });
});

describe('mapping', () => {
  it('keeps local identity when a server response updates an existing row', async () => {
    const local = createLocalNote(1);
    await db.notes.put(local);

    const updated = fromNoteResponse(makeNote({ id: 9 }), local);

    /*
     * The same note, not a new one. Replacing localId would orphan every
     * reference to it — the open editor, and Step 8's queued operations.
     */
    expect(updated.localId).toBe(local.localId);
    expect(updated.clientId).toBe(local.clientId);
    expect(updated.serverId).toBe(9);
    expect(updated.dirty).toBe(0);
  });

  it('does not blank content when a list summary updates a row', () => {
    const existing = fromNoteResponse(makeNote({ id: 4, content: 'the whole note', pinned: false }));
    const merged = fromNoteSummary(makeNoteSummary({ id: 4, pinned: true }), 1, existing);

    /*
     * A summary carries no content. Overwriting with '' would empty every note
     * the moment a list load touched it — data loss that looks exactly like
     * the list working correctly. Other summary-carried fields, like `pinned`,
     * DO get overwritten — that's the contrast this test makes.
     */
    expect(merged.content).toBe('the whole note');
    expect(merged.pinned).toBe(1);
  });
});

describe('meta', () => {
  it('stores the sync cursor as an opaque value', async () => {
    // A LocalDateTime the server hands us and expects back byte for byte.
    // Parsing it into a Date and re-serialising would convert it to UTC,
    // shifting the cursor by the local offset and skipping changes forever.
    await db.meta.put({ key: 'sync.cursor', value: '2026-08-08T10:15:30.123' });

    const stored = await db.meta.get('sync.cursor');
    expect(stored?.value).toBe('2026-08-08T10:15:30.123');
  });
});

describe('the version 1 -> 2 migration (8A)', () => {
  /*
   * NOT a unit test of the upgrade function in isolation — a test that opens
   * a database at version 1 only, seeds it the way a returning user's browser
   * actually would, then reopens it as NotareDatabase and lets DEXIE run the
   * real upgrade. This is the "exercised against real data" the outbox table
   * was deliberately held back from v1 to get.
   */

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
    const trashed = { ...fromNoteResponse(makeNote({ id: 5 })), deleted: 1 as const, dirty: 1 as const };

    const outbox = await migrateFromV1([trashed]);

    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({
      type: 'DELETE',
      localId: trashed.localId,
      noteId: 5,
      // DELETE carries no content (OutboxRow) — nothing else to assert here
      // now that title (5A) is gone from the row entirely.
      content: null,
    });
  });

  it('does NOT queue anything for a synced, non-deleted, dirty note — the genuinely ambiguous case', async () => {
    // Could be an unsent content edit, or could be nothing but an unsent pin.
    // v1 recorded only that SOMETHING changed, not which. See the comment
    // above `this.version(2)` in database.ts.
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
    // Ascending, unbroken — Dexie's auto-increment, not a value we set.
    expect(outbox[1]!.id).toBeGreaterThan(outbox[0]!.id!);
  });
});
