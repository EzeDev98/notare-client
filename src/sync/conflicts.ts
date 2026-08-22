import { fromNoteResponse } from '@/features/notes/local/noteMappers';
import { noteRepository, outboxRepository } from '@/features/notes/local/noteRepository';
import type { NoteRow } from '@/features/notes/local/noteRow';
import { pushOutbox } from '@/sync/push';

/**
 * Resolution for a conflict DETECTED WITHOUT AN EDITOR OPEN — a cold-start
 * push (8C) or a pull (8D) found a dirty row whose base version the server
 * has moved past. `useConflict`/`ConflictPanel` in features/editor handle
 * the OTHER kind: a 409 while the editor is open, where "theirs" comes from
 * a live fetch. This never needs one — the row already carries the
 * server's full note in `conflictNote` (noteRow.ts), which is the entire
 * reason push.ts and reconcile.ts capture it at the moment the conflict is
 * discovered instead of just a version number.
 *
 * Same three outcomes as the editor's keepMine / useTheirs / keepBoth
 * (useNoteEditor.ts), duplicated rather than shared — the editor's versions
 * close over React state (`rowRef`, `scheduler.flush`) that has no
 * equivalent here. The actual merge algorithm (keepBoth's "theirs, divider,
 * mine") is kept byte-identical on purpose: a user should not be able to
 * tell which door they resolved a conflict through.
 */

function requireConflict(row: NoteRow): NonNullable<NoteRow['conflictNote']> {
  if (row.conflictNote === null) {
    throw new Error(`resolveConflict called on a row with no conflictNote: ${row.localId}`);
  }
  return row.conflictNote;
}

/**
 * Re-queues a resolved row for push (keepMine, keepBoth — anything that
 * keeps a local edit the server hasn't seen). Mirrors the branch
 * `outboxRepository`'s own callers already use elsewhere: CREATE if the
 * note has never reached the server, UPDATE otherwise.
 *
 * Pushes IMMEDIATELY rather than waiting for the next `online` event or
 * mount — the user just made a decision, and sitting on "pending" for up to
 * the 60s slow interval (8F, not built yet) would read as the app losing
 * track of what they chose.
 */
async function requeue(row: NoteRow): Promise<void> {
  if (row.serverId === null) {
    await outboxRepository.enqueueCreate({
      localId: row.localId,
      clientId: row.clientId,
      content: row.content,
    });
  } else {
    await outboxRepository.enqueueUpdate({
      localId: row.localId,
      noteId: row.serverId,
      version: row.version,
      content: row.content,
    });
  }

  await pushOutbox().catch(() => {
    // Same reasoning as useSync: the outbox is durable in Dexie regardless
    // of whether this particular call succeeds. The next trigger retries.
  });
}

/**
 * KEEP MINE — a deliberate overwrite. Local text stays; the row adopts the
 * server's version so the requeued push isn't stale against it a second
 * time.
 */
export async function resolveKeepMine(localId: string): Promise<void> {
  const row = await noteRepository.getByLocalId(localId);
  if (!row) return;
  const theirs = requireConflict(row);

  const resolved: NoteRow = {
    ...row,
    version: theirs.version,
    dirty: 1,
    syncState: 'pending',
    conflictNote: null,
  };

  await noteRepository.put(resolved);
  await requeue(resolved);
}

/**
 * USE THEIRS — discard the local draft. Nothing local survives this
 * resolution, so anything still queued for the note is dropped rather than
 * resending an edit the user just discarded.
 */
export async function resolveUseTheirs(localId: string): Promise<void> {
  const row = await noteRepository.getByLocalId(localId);
  if (!row) return;
  const theirs = requireConflict(row);

  await noteRepository.put(fromNoteResponse(theirs, row));
  await outboxRepository.clearForNote(localId);
}

/**
 * KEEP BOTH — the only option that destroys nothing. Theirs first, a
 * divider, then mine — untidy and recoverable, which is the right trade
 * when someone interrupted mid-sentence is about to click the emphasised
 * button. Identical to `useNoteEditor.ts`'s `keepBoth`; see that file if
 * this one ever needs to change; they should change together.
 */
export async function resolveKeepBoth(localId: string): Promise<void> {
  const row = await noteRepository.getByLocalId(localId);
  if (!row) return;
  const theirs = requireConflict(row);

  const theirContent = theirs.content ?? '';
  const mergedContent =
    theirContent.trim() === ''
      ? row.content
      : `${theirContent}\n\n--- Your version ---\n\n${row.content}`;

  const merged: NoteRow = {
    ...row,
    content: mergedContent.slice(0, 20_000),
    version: theirs.version,
    dirty: 1,
    syncState: 'pending',
    localUpdatedAt: Date.now(),
    conflictNote: null,
  };

  await noteRepository.put(merged);
  await requeue(merged);
}
