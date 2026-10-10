import { db } from '@/features/notes/local/database';
import type { PersonRow } from '@/features/notes/local/personRow';

/** The People list, cached for the screen that shows it. */
export const peopleRepository = {
  list(): Promise<PersonRow[]> {
    return db.people.toArray();
  },

  /** Replaces the whole list with what the server just said. */
  replaceAll(rows: PersonRow[]): Promise<void> {
    return db.transaction('rw', db.people, async () => {
      await db.people.clear();
      await db.people.bulkPut(rows);
    });
  },
};
