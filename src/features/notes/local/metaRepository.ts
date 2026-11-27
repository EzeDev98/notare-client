/** Reads and writes single stored values such as the sync cursor. */
import { db } from '@/features/notes/local/database';
import { META_KEYS } from '@/features/notes/local/metaRow';

export const metaRepository = {
  async get<T>(key: string): Promise<T | undefined> {
    const row = await db.meta.get(key);
    return row?.value as T | undefined;
  },

  async set(key: string, value: unknown): Promise<void> {
    await db.meta.put({ key, value });
  },

  async remove(key: string): Promise<void> {
    await db.meta.delete(key);
  },

  getSyncCursor(): Promise<string | undefined> {
    return metaRepository.get<string>(META_KEYS.syncCursor);
  },

  setSyncCursor(cursor: string): Promise<void> {
    return metaRepository.set(META_KEYS.syncCursor, cursor);
  },
};
