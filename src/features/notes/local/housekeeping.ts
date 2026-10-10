import { db } from '@/features/notes/local/database';
import { purgeAtOf } from '@/features/notes/local/trashRules';

/**
 * Removes deleted notes (with their clips and transcripts) once their purge
 * date has passed AND the server no longer needs anything from them (step 8i).
 *
 * "Safe to remove" means one of:
 *   - the server has the note and nothing local is waiting to be sent, or
 *   - the note never reached the server and nothing is queued for it.
 * Anything else stays, however old, so a delete that never synced is never lost.
 *
 * Run once on start-up (sync/engine.ts). Returns how many notes were removed.
 */
export async function purgeExpiredTrash(now: number = Date.now()): Promise<number> {
  return db.transaction('rw', [db.notes, db.clips, db.transcripts, db.outbox], async () => {
    const deleted = await db.notes.filter((row) => row.deleted === 1).toArray();
    let removed = 0;

    for (const row of deleted) {
      const purgeAt = purgeAtOf(row);
      if (purgeAt === null || purgeAt > now) continue;

      const queued = await db.outbox.where('localId').equals(row.localId).count();
      const onServerAndClean =
        row.serverId !== null && row.dirty === 0 && row.syncState === 'synced';
      const neverSentAndIdle = row.serverId === null && queued === 0;
      if (!onServerAndClean && !neverSentAndIdle) continue;

      const clipIds = await db.clips.where('noteId').equals(row.localId).primaryKeys();
      await db.transcripts.bulkDelete(clipIds);
      await db.clips.bulkDelete(clipIds);
      await db.notes.delete(row.localId);
      removed += 1;
    }

    return removed;
  });
}
