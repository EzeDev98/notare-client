import { db } from '@/features/notes/local/database';
import { fromNoteResponse } from '@/features/notes/local/noteMappers';
import type { NoteRow } from '@/features/notes/local/noteRow';
import { noteRepository, outboxRepository } from '@/features/notes/local/noteRepository';
import type { SyncNoteResponse } from '@/sync/types';

/**
 * What happened to one row of a sync pull.
 *
 * Nothing branches on this yet — pull.ts just iterates — but 8E's status
 * surface will, and a caller having to guess this from side effects instead
 * of a return value is the kind of thing that gets rediscovered the hard way.
 */
export type ReconcileOutcome = 'inserted' | 'updated' | 'conflict' | 'skipped';

/**
 * Merges one note from `GET /sync`'s `changed[]` into local storage.
 *
 * MATCHED BY serverId FIRST, THEN clientId — same order and same reasoning
 * as `noteRepository.upsertFromServer`, plus the case that is new here: a
 * note THIS DEVICE created offline, arriving back through a pull that beat
 * our own push's ack (or whose ack was lost and hasn't been retried yet).
 * Matching on serverId alone would insert it a second time — `note.clientId`
 * is the identity WE minted, the server only echoes it, and it's the only
 * thing still tying the two together before this row has a serverId at all.
 *
 * ONE TRANSACTION per note, not one for the whole page — same reasoning as
 * `upsertFromServer`: a read-then-write with nothing holding the lock
 * between them lets a concurrent local edit land in the gap and get
 * silently overwritten by the merge.
 *
 * MERGE RULE (architecture doc §3.8): a CLEAN row takes the server's
 * version outright. A DIRTY row (unsent local edits) is a conflict only if
 * the server has moved past the version that edit was based on — if the
 * versions still match, the edit is still valid against current server
 * state and simply hasn't been pushed yet, so there's nothing to report.
 * This is the same conflict push.ts's CONFLICT branch produces, reached
 * through a different door — detecting it here means it surfaces the
 * moment a pull runs, not only after the next push round-trip.
 */
export function reconcileFromSync(
  note: SyncNoteResponse,
  ownerId: number | null,
): Promise<ReconcileOutcome> {
  return db.transaction('rw', db.notes, async () => {
    const existing =
      (await noteRepository.getByServerId(note.id)) ??
      (note.clientId ? await noteRepository.getByClientId(note.clientId) : undefined);

    if (!existing) {
      const row: NoteRow = fromNoteResponse(note);
      // fromNoteResponse has no reason to know the server's clientId when
      // there's no existing row to preserve one from — it mints a fresh
      // one. Reuse the server's instead when it sent one, or a note this
      // device created offline gets a second, disconnected local identity
      // the moment its own push ack arrives and tries to match by serverId.
      if (note.clientId) row.clientId = note.clientId;
      row.ownerId = ownerId;
      await noteRepository.put(row);
      return 'inserted';
    }

    if (existing.dirty === 1) {
      if (existing.version === note.version) return 'skipped';

      await noteRepository.markConflict(existing.localId, note);
      return 'conflict';
    }

    await noteRepository.put(fromNoteResponse(note, existing));
    return 'updated';
  });
}

/**
 * Evicts a permanently-deleted note — a tombstone id from `GET /sync`'s
 * `deletedIds`.
 *
 * "Absence is not a synchronizable fact" (architecture doc §11) — the
 * server sends an explicit id for exactly this reason, so eviction here is
 * a lookup and a delete, never an inference from a note going missing off
 * a page.
 *
 * Any outbox row for this note is dropped too — same reasoning as push.ts's
 * own NOT_FOUND branch: there is nothing left on the server to apply a
 * queued CREATE/UPDATE/DELETE against.
 */
export async function evictTombstone(serverId: number): Promise<void> {
  const existing = await noteRepository.getByServerId(serverId);
  if (!existing) return;

  await outboxRepository.clearForNote(existing.localId);
  await noteRepository.hardDelete(existing.localId);
}
