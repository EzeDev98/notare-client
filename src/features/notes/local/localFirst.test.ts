import { beforeEach, describe, expect, it } from 'vitest';

import {
  createNoteWithContent,
  duplicateNote,
  findBlankDraft,
  persistDraftIfContent,
  startDraft,
} from '@/features/notes/createNote';
import { clipRepository } from '@/features/notes/local/clipRepository';
import { db } from '@/features/notes/local/database';
import { isEmptyNote } from '@/features/notes/local/isEmptyNote';
import { noteCommands } from '@/features/notes/local/noteCommands';
import { outboxRepository } from '@/features/notes/local/outboxRepository';

/**
 * Step 8l: proof that the bugs the local-first layer was built to remove are
 * gone. Each test names the old bug it guards against.
 */

async function counts() {
  return {
    notes: await db.notes.count(),
    outbox: await db.outbox.count(),
    clips: await db.clips.count(),
  };
}

beforeEach(async () => {
  await db.notes.clear();
  await db.outbox.clear();
  await db.clips.clear();
  await db.transcripts.clear();
});

describe('a blank note', () => {
  it('writes no row and no outbox entry', async () => {
    const draft = startDraft(1);
    await expect(persistDraftIfContent(draft)).resolves.toBeNull();
    draft.content = '   \n ';
    await expect(persistDraftIfContent(draft)).resolves.toBeNull();
    expect(await counts()).toEqual({ notes: 0, outbox: 0, clips: 0 });
  });

  it('ten rapid New note taps leave one blank draft and no rows', async () => {
    // The New note button reuses an open blank draft instead of starting another.
    for (let i = 0; i < 10; i += 1) {
      if (!findBlankDraft()) startDraft(1);
    }
    expect(await counts()).toEqual({ notes: 0, outbox: 0, clips: 0 });
  });
});

describe('the first character', () => {
  it('writes one pending row and exactly one CREATE', async () => {
    const draft = startDraft(1);
    draft.content = 'hello';
    const row = await persistDraftIfContent(draft);

    expect(row).toMatchObject({ content: 'hello', dirty: 1, syncState: 'pending' });
    expect(await counts()).toEqual({ notes: 1, outbox: 1, clips: 0 });
    const queued = await outboxRepository.list();
    expect(queued[0]).toMatchObject({ type: 'CREATE', localId: draft.id, content: 'hello' });
  });

  it('two writes at once still make one row and one CREATE', async () => {
    const draft = startDraft(1);
    draft.content = 'a';
    const [first, second] = await Promise.all([
      persistDraftIfContent(draft),
      persistDraftIfContent(draft),
    ]);

    expect(first?.localId).toBe(second?.localId);
    expect(await counts()).toEqual({ notes: 1, outbox: 1, clips: 0 });
  });

  it('typing more while offline updates the queued CREATE and does not add another', async () => {
    const row = await createNoteWithContent(1, 'one');
    expect(row).not.toBeNull();
    if (!row) return;

    await noteCommands.applyLocalEdit(row.localId, { content: 'one two' });
    await outboxRepository.enqueueCreate({
      localId: row.localId,
      clientId: row.clientId,
      content: 'one two',
    });

    const queued = await outboxRepository.list();
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ type: 'CREATE', content: 'one two' });
    expect((await db.notes.get(row.localId))?.content).toBe('one two');
  });

  it('keeps the text when the app is closed straight after typing', async () => {
    const row = await createNoteWithContent(1, 'do not lose me');
    // Nothing else runs: no sync, no timer. A fresh read finds the text.
    expect((await db.notes.get(row?.localId ?? ''))?.content).toBe('do not lose me');
  });
});

describe('delete', () => {
  it('deleting a note the server never saw drops its CREATE', async () => {
    const row = await createNoteWithContent(1, 'never sent');
    if (!row) throw new Error('row missing');

    await noteCommands.setDeleted(row.localId, true);
    await outboxRepository.discardPendingCreate(row.localId);

    expect(await outboxRepository.count()).toBe(0);
    const deleted = await db.notes.get(row.localId);
    expect(deleted?.deleted).toBe(1);
  });
});

describe('clips keep a note alive', () => {
  it('a blank note with a clip is not empty; without one it is', async () => {
    const draft = startDraft(1);
    expect(isEmptyNote({ content: '', clipCount: 0 })).toBe(true);

    const clip = await clipRepository.add(draft.id, new Blob(['x']), 1000, 'audio/webm');
    draft.clips.push(clip.id);
    const clipCount = await clipRepository.countForNote(draft.id);
    expect(isEmptyNote({ content: draft.content, clipCount })).toBe(false);

    const row = await persistDraftIfContent(draft);
    expect(row).not.toBeNull();
    expect(await counts()).toEqual({ notes: 1, outbox: 1, clips: 1 });
  });

  it('a clip is stored as local, on a note with no server id', async () => {
    const row = await createNoteWithContent(1, 'x');
    if (!row) throw new Error('row missing');
    const clip = await clipRepository.add(row.localId, new Blob(['x']), 2500, 'audio/webm');

    expect(clip).toMatchObject({ uploadState: 'local', serverId: null, noteId: row.localId });
    expect(row.serverId).toBeNull();
    expect((await clipRepository.listToUpload()).map((c) => c.id)).toEqual([clip.id]);
  });

  it('deleting a note for good removes its clips', async () => {
    const row = await createNoteWithContent(1, 'x');
    if (!row) throw new Error('row missing');
    await clipRepository.add(row.localId, new Blob(['x']), 1000, 'audio/webm');

    await noteCommands.hardDelete(row.localId);
    expect(await counts()).toMatchObject({ notes: 0, clips: 0 });
  });

  it('a copy gets its own clips and its own id', async () => {
    const row = await createNoteWithContent(1, 'original');
    if (!row) throw new Error('row missing');
    await clipRepository.add(row.localId, new Blob(['x']), 1000, 'audio/webm');

    const copy = await duplicateNote(1, row.localId, 'original');
    expect(copy?.localId).not.toBe(row.localId);
    expect(await clipRepository.countForNote(copy?.localId ?? '')).toBe(1);
    expect(await clipRepository.countForNote(row.localId)).toBe(1);
  });
});
