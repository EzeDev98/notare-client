import { beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/features/notes/local/database';
import { createLocalNote, fromNoteResponse } from '@/features/notes/local/noteMappers';
import {
  metaRepository,
  noteRepository,
  outboxRepository,
} from '@/features/notes/local/noteRepository';
import { makeNote, makeNoteSummary } from '~/fixtures/notes';

beforeEach(async () => {
  await db.notes.clear();
  await db.meta.clear();
  await db.outbox.clear();
});

describe('listing', () => {
  it('separates active, archived and trashed', async () => {
    await db.notes.bulkPut([
      { ...createLocalNote(1, { content: 'active' }) },
      { ...createLocalNote(1, { content: 'archived' }), archived: 1 },
      { ...createLocalNote(1, { content: 'trashed' }), deleted: 1 },
      // Archived AND trashed: the flags are orthogonal, so this belongs in the
      // bin and must not be hidden by the archived filter.
      { ...createLocalNote(1, { content: 'both' }), archived: 1, deleted: 1 },
      { ...createLocalNote(2, { content: 'someone else' }) },
    ]);

    await expect(noteRepository.listActive(1).then(contents)).resolves.toEqual(['active']);
    await expect(noteRepository.listArchived(1).then(contents)).resolves.toEqual(['archived']);
    await expect(noteRepository.listTrashed(1).then(contents)).resolves.toEqual(
      expect.arrayContaining(['trashed', 'both']),
    );
  });

  it('puts pinned notes first, then the most recently touched', async () => {
    await db.notes.bulkPut([
      { ...createLocalNote(1, { content: 'old' }), localUpdatedAt: 1_000 },
      { ...createLocalNote(1, { content: 'recent' }), localUpdatedAt: 3_000 },
      { ...createLocalNote(1, { content: 'pinned' }), pinned: 1, localUpdatedAt: 2_000 },
    ]);

    // Sorted in memory: a two-key sort with different directions cannot be one
    // IndexedDB index without storing an inverted key.
    await expect(noteRepository.listActive(1).then(contents)).resolves.toEqual([
      'pinned',
      'recent',
      'old',
    ]);
  });
});

describe('searching', () => {
  it('matches content, case-insensitively', async () => {
    // 1B/4F/5C: no title field — the note domain has none, so search has
    // been content-only since 4F. This no longer needs two rows to prove
    // "title OR content" is searched (there is only content); it proves the
    // match works regardless of where in the content the term sits, and
    // regardless of case.
    await db.notes.bulkPut([
      { ...createLocalNote(1, { content: 'Meeting notes: set the agenda' }) },
      { ...createLocalNote(1, { content: 'Groceries: discussed the MEETING room' }) },
      { ...createLocalNote(1, { content: 'Unrelated: nothing here' }) },
    ]);

    await expect(noteRepository.search('meeting', 1).then(contents)).resolves.toEqual(
      expect.arrayContaining([
        'Meeting notes: set the agenda',
        'Groceries: discussed the MEETING room',
      ]),
    );
  });

  it('excludes another owner, and excludes trashed notes', async () => {
    await db.notes.bulkPut([
      { ...createLocalNote(1, { content: 'mine, meeting' }) },
      { ...createLocalNote(2, { content: 'someone else, meeting' }) },
      { ...createLocalNote(1, { content: 'trashed meeting' }), deleted: 1 },
    ]);

    await expect(noteRepository.search('meeting', 1).then(contents)).resolves.toEqual([
      'mine, meeting',
    ]);
  });

  it('includes archived notes — archiving from search must not hide the result', async () => {
    await db.notes.bulkPut([
      { ...createLocalNote(1, { content: 'archived meeting' }), archived: 1 },
    ]);

    await expect(noteRepository.search('meeting', 1).then(contents)).resolves.toEqual([
      'archived meeting',
    ]);
  });

  it('returns nothing for a blank term rather than the whole list', async () => {
    await db.notes.bulkPut([{ ...createLocalNote(1, { content: 'anything' }) }]);

    await expect(noteRepository.search('   ', 1)).resolves.toEqual([]);
  });
});

describe('local edits', () => {
  it('marks a row dirty so the sync engine will push it', async () => {
    const row = createLocalNote(1);
    await db.notes.put({ ...row, dirty: 0, syncState: 'synced' });

    await noteRepository.applyLocalEdit(row.localId, { content: 'written offline' });

    const updated = await noteRepository.getByLocalId(row.localId);
    expect(updated?.content).toBe('written offline');
    expect(updated?.dirty).toBe(1);
    expect(updated?.syncState).toBe('pending');
  });

  it('finds dirty rows for the push', async () => {
    await db.notes.bulkPut([
      createLocalNote(1, { content: 'unsent' }),
      { ...fromNoteResponse(makeNote({ id: 5 })), dirty: 0 },
    ]);

    await expect(noteRepository.listDirty().then(contents)).resolves.toEqual(['unsent']);
  });
});

describe('applying server state', () => {
  it('inserts a note it has never seen', async () => {
    await expect(noteRepository.upsertFromServer(makeNote({ id: 8 }))).resolves.toBe('inserted');
    expect(await noteRepository.getByServerId(8)).toBeDefined();
  });

  it('updates a clean row and keeps its local identity', async () => {
    const first = fromNoteResponse(makeNote({ id: 8, content: 'before' }));
    await db.notes.put(first);

    await expect(
      noteRepository.upsertFromServer(makeNote({ id: 8, content: 'after', version: 2 })),
    ).resolves.toBe('updated');

    const row = await noteRepository.getByServerId(8);
    expect(row?.content).toBe('after');
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
    // 5C: a summary carries only `contentPreview`, and fromNoteSummary does
    // not fold that into `content` (a separate, pre-existing gap noted back
    // in step 4 — out of scope here). This test's actual point survives
    // regardless: a DIRTY row's content must not be touched by an incoming
    // list page at all, whatever that page contains.
    const local = fromNoteResponse(makeNote({ id: 3, content: 'my rename' }));
    await db.notes.put({ ...local, dirty: 1 });

    await noteRepository.upsertSummaries(
      [makeNoteSummary({ id: 3, contentPreview: 'server update' })],
      1,
    );

    expect((await noteRepository.getByServerId(3))?.content).toBe('my rename');
  });

  it('stamps the owner on rows a list page inserts', async () => {
    /*
     * 7E. A summary has no ownerId, and the mapper used to fall back to null
     * when there was no existing row. Every read is scoped by owner through
     * the [ownerId+deleted+archived] index, so a null-owned row is invisible —
     * on a fresh device the fetch succeeded and the list stayed empty forever.
     */
    await noteRepository.upsertSummaries([makeNoteSummary({ id: 30 })], 7);

    expect((await noteRepository.getByServerId(30))?.ownerId).toBe(7);
    expect(await noteRepository.listActive(7)).toHaveLength(1);
  });

  it('marks a trash page as deleted and keeps it out of the notes list', async () => {
    await noteRepository.upsertTrashedNotes(
      [{ note: makeNoteSummary({ id: 31 }), deletedAt: '2026-08-05T14:00:00.000' }],
      7,
    );

    const stored = await noteRepository.getByServerId(31);
    expect(stored?.deleted).toBe(1);
    expect(stored?.deletedAt).toBe('2026-08-05T14:00:00.000');

    // One table, two queries. The trash is a filter, not a second store.
    expect(await noteRepository.listActive(7)).toHaveLength(0);
    expect(await noteRepository.listTrashed(7)).toHaveLength(1);
  });

  it('does not re-trash a note the user has just restored', async () => {
    /*
     * The restore wrote locally and left the row dirty. A trash page fetched
     * before that write must not land on top of it and put the note back in
     * the bin in front of the user.
     */
    const local = fromNoteResponse(makeNote({ id: 32 }));
    await db.notes.put({ ...local, ownerId: 7, deleted: 0, dirty: 1 });

    await noteRepository.upsertTrashedNotes(
      [{ note: makeNoteSummary({ id: 32 }), deletedAt: '2026-08-05T14:00:00.000' }],
      7,
    );

    expect((await noteRepository.getByServerId(32))?.deleted).toBe(0);
  });
});

describe('transactions', () => {
  it('commits database work atomically', async () => {
    const row = createLocalNote(1);
    await db.notes.put(row);

    await db.transaction('rw', db.notes, async () => {
      const existing = await db.notes.get(row.localId);
      if (!existing) throw new Error('expected note to exist');

      await db.notes.put({
        ...existing,
        content: 'updated inside transaction',
      });
    });

    await expect(db.notes.get(row.localId)).resolves.toMatchObject({
      localId: row.localId,
      content: 'updated inside transaction',
    });
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

describe('the outbox (8B)', () => {
  const note = { localId: 'local-1', clientId: 'client-1', content: 'Body' };

  describe('enqueueCreate', () => {
    it('queues one CREATE', async () => {
      await outboxRepository.enqueueCreate(note);

      const rows = await outboxRepository.listForNote(note.localId);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        type: 'CREATE',
        localId: note.localId,
        clientId: note.clientId,
        content: 'Body',
        noteId: null,
      });
    });

    it('coalesces a second call into the SAME row rather than appending', async () => {
      await outboxRepository.enqueueCreate(note);
      const [first] = await outboxRepository.listForNote(note.localId);

      await outboxRepository.enqueueCreate({ ...note, content: 'New body' });

      const rows = await outboxRepository.listForNote(note.localId);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.id).toBe(first!.id);
      expect(rows[0]).toMatchObject({ content: 'New body' });
      expect(rows[0]!.operationId).toBe(first!.operationId);
    });
  });

  describe('enqueueUpdate', () => {
    const update = { localId: 'local-2', noteId: 7, content: 'Body' };

    it('queues one UPDATE', async () => {
      await outboxRepository.enqueueUpdate(update);

      const rows = await outboxRepository.listForNote(update.localId);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ type: 'UPDATE', noteId: 7 });
    });

    it('coalesces repeated offline edits into the same row', async () => {
      await outboxRepository.enqueueUpdate(update);
      const [first] = await outboxRepository.listForNote(update.localId);

      await outboxRepository.enqueueUpdate({ ...update, content: 'Edited again' });

      const rows = await outboxRepository.listForNote(update.localId);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.id).toBe(first!.id);
      expect(rows[0]!.content).toBe('Edited again');
    });
  });

  describe('enqueueDelete', () => {
    it('queues a DELETE', async () => {
      await outboxRepository.enqueueDelete({ localId: 'local-3', noteId: 9 });

      const rows = await outboxRepository.listForNote('local-3');
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ type: 'DELETE', noteId: 9, content: null });
    });

    it('discards a queued UPDATE for the same note — the final state is deleted, content no longer matters', async () => {
      await outboxRepository.enqueueUpdate({
        localId: 'local-4',
        noteId: 9,
        content: 'y',
      });

      await outboxRepository.enqueueDelete({ localId: 'local-4', noteId: 9 });

      const rows = await outboxRepository.listForNote('local-4');
      expect(rows).toHaveLength(1);
      expect(rows[0]!.type).toBe('DELETE');
    });
  });

  describe('discardPendingCreate', () => {
    it('drops a queued CREATE', async () => {
      await outboxRepository.enqueueCreate(note);

      await outboxRepository.discardPendingCreate(note.localId);

      await expect(outboxRepository.listForNote(note.localId)).resolves.toEqual([]);
    });

    it('leaves a queued UPDATE alone — it is not a CREATE', async () => {
      await outboxRepository.enqueueUpdate({
        localId: 'local-5',
        noteId: 1,
        content: 'y',
      });

      await outboxRepository.discardPendingCreate('local-5');

      await expect(outboxRepository.listForNote('local-5')).resolves.toHaveLength(1);
    });
  });

  describe('cancelPendingDelete', () => {
    it('drops a queued DELETE — a restore before the push must undo it', async () => {
      await outboxRepository.enqueueDelete({ localId: 'local-6', noteId: 1 });

      await outboxRepository.cancelPendingDelete('local-6');

      await expect(outboxRepository.listForNote('local-6')).resolves.toEqual([]);
    });

    it('leaves a queued CREATE or UPDATE alone — neither is a DELETE', async () => {
      await outboxRepository.enqueueCreate(note);

      await outboxRepository.cancelPendingDelete(note.localId);

      await expect(outboxRepository.listForNote(note.localId)).resolves.toHaveLength(1);
    });
  });

  describe('clearForNote', () => {
    it('drops whatever is queued, regardless of type', async () => {
      await outboxRepository.enqueueCreate(note);

      await outboxRepository.clearForNote(note.localId);

      await expect(outboxRepository.listForNote(note.localId)).resolves.toEqual([]);
    });
  });

  describe('applyServerAck', () => {
    it('clears a queued operation once the server has acked directly, even though nothing pushed it', async () => {
      const row = { ...fromNoteResponse(makeNote({ id: 4 })), dirty: 1 as const };
      await db.notes.put(row);
      await outboxRepository.enqueueUpdate({
        localId: row.localId,
        noteId: 4,
        content: row.content,
      });

      await noteRepository.applyServerAck(
        row.localId,
        { version: (row.version ?? 0) + 1, updatedAt: row.updatedAt },
        row.localUpdatedAt,
      );

      await expect(outboxRepository.listForNote(row.localId)).resolves.toEqual([]);
    });
  });

  it('never holds more than one row per note across a create-then-edit-then-delete lifecycle', async () => {
    const localId = 'local-lifecycle';

    await outboxRepository.enqueueCreate({ localId, clientId: 'c1', content: 'v1' });
    await outboxRepository.enqueueCreate({ localId, clientId: 'c1', content: 'v2' });
    await outboxRepository.enqueueDelete({ localId, noteId: 42 });

    const rows = await outboxRepository.listForNote(localId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.type).toBe('DELETE');
  });
});

// 1B/5C: no title field — the note domain has none, so every list/search
// assertion above reads content, which is the only label a note has left.
function contents(rows: { content: string }[]): string[] {
  return rows.map((row) => row.content);
}
