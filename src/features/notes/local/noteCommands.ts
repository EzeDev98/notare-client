import { db } from '@/features/notes/local/database';
import { flag } from '@/features/notes/local/noteMappers';
import type { NoteRow } from '@/features/notes/local/noteRow';
import { purgeAtFor } from '@/features/notes/local/trashRules';
import { toServerDateTime } from '@/lib/time';

/**
 * Local writes to the notes table (step 8c): what the person does. Server
 * acknowledgements and applying what the server sent are in noteServerWrites.ts.
 *
 * Every read-modify-write is in a transaction. Outside one, a concurrent
 * editor write between the read and the write is silently lost.
 */
export const noteCommands = {
  put(row: NoteRow): Promise<string> {
    return db.notes.put(row);
  },

  /**
   * Applies a local edit: writes the fields, marks the row dirty, and stamps
   * localUpdatedAt.
   *
   * A transaction because it is read-modify-write. Without one, two edits
   * landing in the same tick can both read the pre-edit row and the second
   * write wins wholesale — losing whichever field the first one changed.
   */
  /**
   * Step 12b: saves the body built from a note's old text the first time it is
   * opened. Opening is not an edit, so this does NOT set dirty, change the sync
   * state or restamp localUpdatedAt (the note must not jump to the top of the
   * list). It never replaces a body that already exists.
   */
  saveSeedBodyState(localId: string, bodyState: Uint8Array): Promise<void> {
    return db.transaction('rw', db.notes, async () => {
      const existing = await db.notes.get(localId);
      if (!existing || existing.bodyState) return;

      await db.notes.put({ ...existing, bodyState });
    });
  },

  applyLocalEdit(
    localId: string,
    changes: Partial<Pick<NoteRow, 'content' | 'pinned' | 'archived' | 'bodyState'>>,
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

  /**
   * Soft delete: the row stays, so a restore is local and instant.
   *
   * Deleting stamps deletedAt and a purge date (deletedAt + TRASH_DAYS, until
   * the server sends its own). Restoring clears both (step 8i, M-7, M-15).
   */
  setDeleted(localId: string, deleted: boolean): Promise<void> {
    return db.transaction('rw', db.notes, async () => {
      const existing = await db.notes.get(localId);
      if (!existing) return;

      const now = Date.now();
      await db.notes.put({
        ...existing,
        deleted: flag(deleted),
        deletedAt: deleted ? toServerDateTime(new Date(now)) : null,
        purgeAt: deleted ? purgeAtFor(now) : null,
        dirty: 1,
        syncState: 'pending',
        localUpdatedAt: now,
      });
    });
  },

  /**
   * Removes a row entirely, with its clips and their transcripts. For a
   * permanent delete, or evicting a tombstone.
   */
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
      [db.notes, db.clips, db.transcripts, db.shared, db.people, db.notifications],
      async () => {
        await Promise.all([
          db.notes.clear(),
          db.clips.clear(),
          db.transcripts.clear(),
          db.shared.clear(),
          db.people.clear(),
          db.notifications.clear(),
        ]);
      },
    );
  },
};
