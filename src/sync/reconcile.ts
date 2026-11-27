/** Merges one pulled note into the device. */
import { db } from '@/features/notes/local/database';
import { fromNoteResponse, isSameRow } from '@/features/notes/local/noteMappers';
import type { NoteRow } from '@/features/notes/local/noteRow';
import { noteRepository, outboxRepository } from '@/features/notes/local/noteRepository';
import type { SyncChangedEntry } from '@/sync/types';

export type ReconcileOutcome = 'inserted' | 'updated' | 'skipped';

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
      if (clientId) {
        row.clientId = clientId;
        row.localId = clientId;
      }
      row.ownerId = ownerId;
      await noteRepository.put(row);
      return 'inserted';
    }

    if (existing.dirty === 1) return 'skipped';

    const next = fromNoteResponse(note, existing);
    if (isSameRow(existing, next)) return 'skipped';

    await noteRepository.put(next);
    return 'updated';
  });
}

export async function evictTombstone(serverId: number): Promise<void> {
  const existing = await noteRepository.getByServerId(serverId);
  if (!existing) return;

  await outboxRepository.clearForNote(existing.localId);
  await noteRepository.hardDelete(existing.localId);
}
