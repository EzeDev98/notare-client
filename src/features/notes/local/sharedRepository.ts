import { db } from '@/features/notes/local/database';
import type { SharedRow } from '@/features/notes/local/sharedRow';

/** "Shared with me", a read-only copy filled by sync or the adapter. */
export const sharedRepository = {
  /** Most recently updated first. */
  list(): Promise<SharedRow[]> {
    return db.shared.orderBy('updatedAt').reverse().toArray();
  },

  get(noteId: number): Promise<SharedRow | undefined> {
    return db.shared.get(noteId);
  },

  /** Replaces the whole list with what the server just said. */
  replaceAll(rows: SharedRow[]): Promise<void> {
    return db.transaction('rw', db.shared, async () => {
      await db.shared.clear();
      await db.shared.bulkPut(rows);
    });
  },
};
