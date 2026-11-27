/** Writes to the notes table for what the person does. */
import { db } from '@/features/notes/local/database';
import { flag } from '@/features/notes/local/noteMappers';
import type { NoteRow } from '@/features/notes/local/noteRow';
import { toServerDateTime } from '@/lib/time';

export const noteCommands = {
  put(row: NoteRow): Promise<string> {
    return db.notes.put(row);
  },

  saveSeedBodyState(localId: string, bodyState: Uint8Array, bodySeedVersion: number): Promise<void> {
    return db.transaction('rw', db.notes, async () => {
      const existing = await db.notes.get(localId);
      if (!existing || existing.bodyState) return;

      await db.notes.put({ ...existing, bodyState, bodySeedVersion });
    });
  },

  applyLocalEdit(
    localId: string,
    changes: Partial<Pick<NoteRow, 'content' | 'pinned' | 'bodyState'>>,
  ): Promise<void> {
    return db.transaction('rw', db.notes, async () => {
      const existing = await db.notes.get(localId);
      if (!existing) return;

      await db.notes.put({
        ...existing,
        ...changes,
        dirty: 1,
        syncState: 'pending',
        localUpdatedAt: Date.now(),
      });
    });
  },

  setDeleted(localId: string, deleted: boolean): Promise<void> {
    return db.transaction('rw', db.notes, async () => {
      const existing = await db.notes.get(localId);
      if (!existing) return;

      const now = Date.now();
      await db.notes.put({
        ...existing,
        deleted: flag(deleted),
        deletedAt: deleted ? toServerDateTime(new Date(now)) : null,
        dirty: 1,
        syncState: 'pending',
        localUpdatedAt: now,
      });
    });
  },

  hardDelete(localId: string): Promise<void> {
    return db.transaction('rw', db.notes, db.clips, db.transcripts, async () => {
      const clipIds = await db.clips.where('noteId').equals(localId).primaryKeys();
      await db.transcripts.bulkDelete(clipIds);
      await db.clips.bulkDelete(clipIds);
      await db.notes.delete(localId);
    });
  },

  async clear(): Promise<void> {
    await db.transaction(
      'rw',
      [db.notes, db.clips, db.transcripts, db.notifications],
      async () => {
        await Promise.all([
          db.notes.clear(),
          db.clips.clear(),
          db.transcripts.clear(),
          db.notifications.clear(),
        ]);
      },
    );
  },
};
