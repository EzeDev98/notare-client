import { beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/features/notes/local/database';
import {
  createLocalNote,
  fromNoteResponse,
  fromNoteSummary,
} from '@/features/notes/local/noteMappers';
import { makeNote, makeNoteSummary } from '~/fixtures/notes';

beforeEach(async () => {
  await db.notes.clear();
  await db.meta.clear();
});

describe('the notes table', () => {
  it('stores a note created offline, with no server id', async () => {
    const row = createLocalNote(1, { title: 'Offline', content: 'written on a train' });
    await db.notes.put(row);

    const stored = await db.notes.get(row.localId);

    /*
     * The reason localId is the primary key: IndexedDB rejects a null key
     * outright, and an identity that only appears after a round trip is not an
     * identity — the editor and Step 8's outbox both reference this note long
     * before any server has seen it.
     */
    expect(stored?.serverId).toBeNull();
    expect(stored?.title).toBe('Offline');
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
      { ...createLocalNote(1, { title: 'visible' }), deleted: 0, archived: 0 },
      { ...createLocalNote(1, { title: 'archived' }), deleted: 0, archived: 1 },
      { ...createLocalNote(1, { title: 'trashed' }), deleted: 1, archived: 0 },
      { ...createLocalNote(2, { title: 'someone else' }), deleted: 0, archived: 0 },
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
    expect(mine.map((row) => row.title)).toEqual(['visible']);
  });

  it('finds dirty rows for Step 8 to push', async () => {
    await db.notes.bulkPut([
      createLocalNote(1, { title: 'unsent' }),
      { ...fromNoteResponse(makeNote({ id: 3 })), dirty: 0 },
    ]);

    const pending = await db.notes.where('dirty').equals(1).toArray();

    /*
     * dirty is 0/1 rather than a boolean because IndexedDB CANNOT INDEX
     * BOOLEANS. where('dirty').equals(true) matches nothing — no error, an
     * empty result, and a sync engine that silently never pushes.
     */
    expect(pending).toHaveLength(1);
    expect(pending[0]?.title).toBe('unsent');
  });
});

describe('mapping', () => {
  it('keeps local identity when a server response updates an existing row', async () => {
    const local = createLocalNote(1, { title: 'draft' });
    await db.notes.put(local);

    const updated = fromNoteResponse(makeNote({ id: 9, title: 'draft' }), local);

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
    const existing = fromNoteResponse(makeNote({ id: 4, content: 'the whole note' }));
    const merged = fromNoteSummary(makeNoteSummary({ id: 4, title: 'Renamed' }), 1, existing);

    /*
     * A summary carries no content. Overwriting with '' would empty every note
     * the moment a list load touched it — data loss that looks exactly like
     * the list working correctly.
     */
    expect(merged.content).toBe('the whole note');
    expect(merged.title).toBe('Renamed');
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
