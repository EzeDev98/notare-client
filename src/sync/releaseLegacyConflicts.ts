/** One-time cleanup of notes left in the old conflict state. */
import { db } from '@/features/notes/local/database';
import { noteCommands } from '@/features/notes/local/noteCommands';
import { outboxRepository } from '@/features/notes/local/outboxRepository';
import type { NoteRow } from '@/features/notes/local/noteRow';

export async function releaseLegacyConflicts(): Promise<void> {
  const stuck = await db.notes.where('syncState').equals('conflict').toArray();

  for (const row of stuck) {
    const cleaned: Record<string, unknown> = { ...row };
    delete cleaned['conflictNote'];
    await noteCommands.put({
      ...(cleaned as unknown as NoteRow),
      syncState: 'pending',
      dirty: 1,
    });

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
