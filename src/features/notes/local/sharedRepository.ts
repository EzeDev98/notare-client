import { db } from '@/features/notes/local/database';
import type { SharedRow } from '@/features/notes/local/sharedRow';

/** "Shared with me", a read-only copy filled by sync or the adapter. */
export const sharedRepository = {
  /** Most recently updated first. */
  list(): Promise<SharedRow[]> {
    return db.shared.orderBy('updatedAt').reverse().toArray();
  },

  count(): Promise<number> {
    return db.shared.count();
  },

  get(noteId: number): Promise<SharedRow | undefined> {
    return db.shared.get(noteId);
  },

  /** Forgets one shared note, for example after the person left it. */
  async remove(noteId: number): Promise<void> {
    await db.shared.delete(noteId);
  },

  /** Replaces the whole list with what the server just said. */
  replaceAll(rows: SharedRow[]): Promise<void> {
    return db.transaction('rw', db.shared, async () => {
      await db.shared.clear();
      await db.shared.bulkPut(rows);
    });
  },
};
