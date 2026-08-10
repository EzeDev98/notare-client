import { beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/features/notes/local/database';
import { createLocalNote, fromNoteResponse } from '@/features/notes/local/noteMappers';
import { metaRepository, noteRepository } from '@/features/notes/local/noteRepository';
import { makeNote, makeNoteSummary } from '~/fixtures/notes';

beforeEach(async () => {
  await db.notes.clear();
  await db.meta.clear();
});

describe('listing', () => {
  it('separates active, archived and trashed', async () => {
    await db.notes.bulkPut([
      { ...createLocalNote(1, { title: 'active' }) },
      { ...createLocalNote(1, { title: 'archived' }), archived: 1 },
      { ...createLocalNote(1, { title: 'trashed' }), deleted: 1 },
      // Archived AND trashed: the flags are orthogonal, so this belongs in the
      // bin and must not be hidden by the archived filter.
      { ...createLocalNote(1, { title: 'both' }), archived: 1, deleted: 1 },
      { ...createLocalNote(2, { title: 'someone else' }) },
    ]);

    await expect(noteRepository.listActive(1).then(titles)).resolves.toEqual(['active']);
    await expect(noteRepository.listArchived(1).then(titles)).resolves.toEqual(['archived']);
    await expect(noteRepository.listTrashed(1).then(titles)).resolves.toEqual(
      expect.arrayContaining(['trashed', 'both']),
    );
  });

  it('puts pinned notes first, then the most recently touched', async () => {
    await db.notes.bulkPut([
      { ...createLocalNote(1, { title: 'old' }), localUpdatedAt: 1_000 },
      { ...createLocalNote(1, { title: 'recent' }), localUpdatedAt: 3_000 },
      { ...createLocalNote(1, { title: 'pinned' }), pinned: 1, localUpdatedAt: 2_000 },
    ]);

    // Sorted in memory: a two-key sort with different directions cannot be one
    // IndexedDB index without storing an inverted key.
    await expect(noteRepository.listActive(1).then(titles)).resolves.toEqual([
      'pinned',
      'recent',
      'old',
    ]);
  });
});

describe('local edits', () => {
  it('marks a row dirty so the sync engine will push it', async () => {
    const row = createLocalNote(1, { title: 'draft' });
    await db.notes.put({ ...row, dirty: 0, syncState: 'synced' });

    await noteRepository.applyLocalEdit(row.localId, { content: 'written offline' });

    const updated = await noteRepository.getByLocalId(row.localId);
    expect(updated?.content).toBe('written offline');
    expect(updated?.dirty).toBe(1);
    expect(updated?.syncState).toBe('pending');
  });

  it('does not clear a conflict by editing', async () => {
    const row = createLocalNote(1);
    await db.notes.put({ ...row, syncState: 'conflict' });

    await noteRepository.applyLocalEdit(row.localId, { content: 'more' });

    /*
     * The same rule as the editor's save machine (6B): typing does not resolve
     * a conflict. Quietly returning to 'pending' would let the next push
     * overwrite somebody else's work.
     */
    expect((await noteRepository.getByLocalId(row.localId))?.syncState).toBe('conflict');
  });

  it('finds dirty rows for the push', async () => {
    await db.notes.bulkPut([
      createLocalNote(1, { title: 'unsent' }),
      { ...fromNoteResponse(makeNote({ id: 5 })), dirty: 0 },
    ]);

    await expect(noteRepository.listDirty().then(titles)).resolves.toEqual(['unsent']);
  });
});

describe('applying server state', () => {
  it('inserts a note it has never seen', async () => {
    await expect(noteRepository.upsertFromServer(makeNote({ id: 8 }))).resolves.toBe('inserted');
    expect(await noteRepository.getByServerId(8)).toBeDefined();
  });

  it('updates a clean row and keeps its local identity', async () => {
    const first = fromNoteResponse(makeNote({ id: 8, title: 'before' }));
    await db.notes.put(first);

    await expect(
      noteRepository.upsertFromServer(makeNote({ id: 8, title: 'after', version: 2 })),
    ).resolves.toBe('updated');

    const row = await noteRepository.getByServerId(8);
    expect(row?.title).toBe('after');
    // Same note, not a new one — the open editor and the outbox both reference
    // this localId.
    expect(row?.localId).toBe(first.localId);
  });

  it('SKIPS a dirty row rather than deciding for the user', async () => {
    const local = fromNoteResponse(makeNote({ id: 8, content: 'my unsent words' }));
    await db.notes.put({ ...local, dirty: 1, content: 'my unsent words' });

    const result = await noteRepository.upsertFromServer(
      makeNote({ id: 8, content: 'their words', version: 9 }),
    );

    /*
     * The whole reason this returns a value. Overwriting would destroy unsent
     * work; keeping local silently would hide a conflict. Which of those is
     * right is a POLICY decision, and 7F owns it — burying it here would put
     * the most consequential choice in the layer least able to explain it.
     */
    expect(result).toBe('skipped');
    expect((await noteRepository.getByServerId(8))?.content).toBe('my unsent words');
  });

  it('leaves dirty rows alone when applying a list page', async () => {
    const local = fromNoteResponse(makeNote({ id: 3, title: 'my rename' }));
    await db.notes.put({ ...local, dirty: 1 });

    await noteRepository.upsertSummaries([makeNoteSummary({ id: 3, title: 'server title' })]);

    expect((await noteRepository.getByServerId(3))?.title).toBe('my rename');
  });
});

describe('transactions', () => {
  it('closes when awaiting anything outside the database', async () => {
    /*
     * THE TRAP WORTH MEETING ONCE.
     *
     * IndexedDB transactions auto-commit when the microtask queue drains with
     * no pending requests against them. Awaiting a network call — or anything
     * that yields to the event loop — lets that happen, and the next database
     * operation throws TransactionInactiveError.
     *
     * Genuinely surprising coming from JPA, where a transaction is bounded by
     * a method and survives whatever you call inside it. Here the rule is:
     * a transaction contains DATABASE WORK ONLY. Fetch first, then transact.
     */
    const row = createLocalNote(1);
    await db.notes.put(row);

    await expect(
      db.transaction('rw', db.notes, async () => {
        await db.notes.get(row.localId);
        // Stands in for a fetch. Any yield to the event loop does this.
        await new Promise((resolve) => setTimeout(resolve, 0));
        await db.notes.put({ ...row, title: 'too late' });
      }),
    ).rejects.toThrow();
  });
});

describe('meta', () => {
  it('round-trips the sync cursor without touching its format', async () => {
    await metaRepository.setSyncCursor('2026-08-08T10:15:30.123');

    // Byte for byte. Parsing it into a Date and back would convert to UTC,
    // shifting the cursor by the local offset and skipping changes forever.
    await expect(metaRepository.getSyncCursor()).resolves.toBe('2026-08-08T10:15:30.123');
  });
});

function titles(rows: { title: string }[]): string[] {
  return rows.map((row) => row.title);
}
