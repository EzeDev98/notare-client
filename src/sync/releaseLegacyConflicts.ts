import { db } from '@/features/notes/local/database';
import { outboxRepository } from '@/features/notes/local/noteRepository';
import type { NoteRow } from '@/features/notes/local/noteRow';

/**
 * One-time cleanup for notes that were parked in the old "conflict" state.
 *
 * Conflicts no longer exist: the latest edit always wins. A note left in that
 * state by an earlier version of the app would otherwise stay stuck, so it is
 * released here and its local text is queued to overwrite the server copy.
 * Safe to run on every start; it does nothing once no such rows remain.
 */
export async function releaseLegacyConflicts(): Promise<void> {
  const stuck = await db.notes.where('syncState').equals('conflict').toArray();

  for (const row of stuck) {
    const cleaned: Record<string, unknown> = { ...row };
    delete cleaned['conflictNote'];
    await db.notes.put({ ...(cleaned as unknown as NoteRow), syncState: 'pending', dirty: 1 });

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
        content: row.content,
      });
    }
  }
}
