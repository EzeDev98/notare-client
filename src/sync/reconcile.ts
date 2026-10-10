import { db } from '@/features/notes/local/database';
import { fromNoteResponse, isSameRow } from '@/features/notes/local/noteMappers';
import type { NoteRow } from '@/features/notes/local/noteRow';
import { noteRepository, outboxRepository } from '@/features/notes/local/noteRepository';
import type { SyncChangedEntry } from '@/sync/types';

/**
 * What happened to one row of a sync pull.
 *
 * Nothing branches on this yet — pull.ts just iterates — but 8E's status
 * surface will, and a caller having to guess this from side effects instead
 * of a return value is the kind of thing that gets rediscovered the hard way.
 */
export type ReconcileOutcome = 'inserted' | 'updated' | 'skipped';

/**
 * Merges one note from `GET /sync`'s `changed[]` into local storage.
 *
 * Takes the WRAPPER entry (`{ note, clientId }`, per types.ts's own doc
 * comment on `SyncChangedEntry`), not a flat merged object — destructured
 * immediately below so the rest of this function reads `note.id` etc.
 * against the actual `NoteResponse`, not the wrapper.
 *
 * MATCHED BY serverId FIRST, THEN clientId — same order and same reasoning
 * as `noteRepository.upsertFromServer`, plus the case that is new here: a
 * note THIS DEVICE created offline, arriving back through a pull that beat
 * our own push's ack (or whose ack was lost and hasn't been retried yet).
 * Matching on serverId alone would insert it a second time — `clientId` is
 * the identity WE minted, the server only echoes it, and it's the only
 * thing still tying the two together before this row has a serverId at all.
 *
 * ONE TRANSACTION per note, not one for the whole page — same reasoning as
 * `upsertFromServer`: a read-then-write with nothing holding the lock
 * between them lets a concurrent local edit land in the gap and get
 * silently overwritten by the merge.
 *
 * MERGE RULE: a CLEAN row takes the server's version outright. A DIRTY row
 * (unsent local edits) is left alone — last write wins, so the local edit is
 * pushed next and replaces whatever the server holds.
 */
export function reconcileFromSync(
  entry: SyncChangedEntry,
  ownerId: number | null,
): Promise<ReconcileOutcome> {
  const { note, clientId } = entry;

  return db.transaction('rw', db.notes, async () => {
    const existing =
      (await noteRepository.getByServerId(note.id)) ??
      (clientId ? await noteRepository.getByClientId(clientId) : undefined);

    if (!existing) {
      const row: NoteRow = fromNoteResponse(note);
      // fromNoteResponse has no reason to know the server's clientId when
      // there's no existing row to preserve one from — it mints a fresh
      // one. Reuse the server's instead when it sent one, or a note this
      // device created offline gets a second, disconnected local identity
      // the moment its own push ack arrives and tries to match by serverId.
      // The note's identity is its clientId, so the local key follows it.
      if (clientId) {
        row.clientId = clientId;
        row.localId = clientId;
      }
      row.ownerId = ownerId;
      await noteRepository.put(row);
      return 'inserted';
    }

    // Unsent local edits win: they are pushed next and overwrite the server.
    if (existing.dirty === 1) return 'skipped';

    const next = fromNoteResponse(note, existing);
    if (isSameRow(existing, next)) return 'skipped';

    await noteRepository.put(next);
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
