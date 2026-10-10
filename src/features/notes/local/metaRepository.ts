import { db } from '@/features/notes/local/database';
import { META_KEYS } from '@/features/notes/local/metaRow';

/** The sync cursor and other single values. Opaque to everything but Step 8. */
export const metaRepository = {
  async get<T>(key: string): Promise<T | undefined> {
    const row = await db.meta.get(key);
    return row?.value as T | undefined;
  },

  async set(key: string, value: unknown): Promise<void> {
    await db.meta.put({ key, value });
  },

  /**
   * The sync cursor, kept as an opaque string.
   *
   * It is a LocalDateTime the server hands us and expects back byte for byte.
   * It must never touch lib/time.ts — parsing and re-serialising converts it
   * to UTC, shifting it by the local offset and skipping changes permanently.
   */
  getSyncCursor(): Promise<string | undefined> {
    return metaRepository.get<string>(META_KEYS.syncCursor);
  },

  setSyncCursor(cursor: string): Promise<void> {
    return metaRepository.set(META_KEYS.syncCursor, cursor);
  },
};
