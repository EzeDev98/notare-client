import { db } from '@/features/notes/local/database';
import type { NoteRow } from '@/features/notes/local/noteRow';

/**
 * Reads from the local notes table (step 8c). Nothing here writes.
 *
 * Not ceremony over db.notes: a caller writing where('deleted').equals(false)
 * gets an empty result with no error, because flags are stored as 0 | 1 (7A),
 * and where('[ownerId+deleted]').equals([1, 0]) does not explain
 * itself. Each query is named here once.
 */

/**
 * Sorting happens in memory, not in the index.
 *
 * The list is ordered pinned-first then most-recently-touched, which is a
 * two-key sort with different directions — IndexedDB indexes are
 * single-direction, so expressing it as an index would mean storing an
 * inverted key. Sorting a few hundred rows in JS costs microseconds and keeps
 * the schema honest.
 *
 * If a user ever has enough notes for this to matter, the answer is a
 * paginated cursor over the index, not a cleverer key.
 */
function byPinnedThenRecent(a: NoteRow, b: NoteRow): number {
  if (a.pinned !== b.pinned) return b.pinned - a.pinned;
  return b.localUpdatedAt - a.localUpdatedAt;
}

/**
 * Most recently touched first, IGNORING pinned.
 *
 * Search results use this rather than byPinnedThenRecent.
 */
function byRecent(a: NoteRow, b: NoteRow): number {
  return b.localUpdatedAt - a.localUpdatedAt;
}

/** The numbers the drawer shows. `waiting` is every row the server has not accepted yet. */
export interface NoteCounts {
  all: number;
  waiting: number;
}

export const noteQueries = {
  /** The main list: mine, not deleted. */
  async listActive(ownerId: number): Promise<NoteRow[]> {
    const rows = await db.notes.where('[ownerId+deleted]').equals([ownerId, 0]).toArray();
    return rows.sort(byPinnedThenRecent);
  },

  /**
   * Searches content, locally. (7G)
   *
   * CONTENT ONLY — 1B/4F: the note domain has no title field to search
   * separately any more, and there is no longer a title-match-ranks-first
   * tier (`bySearchRank`, removed) to apply on top of it. Recency (`byRecent`)
   * is the whole ordering now, same as the conflicts list.
   *
   * A SUBSTRING SCAN, not an inverted index. This is one person's own notes,
   * not a search engine over a shared corpus — the realistic dataset size
   * does not justify tokenisation, index maintenance on every keystroke, and
   * a second copy of every note's words. If someone's note count ever makes
   * this slow, that is the moment to build an index, not before.
   *
   * SCOPE matches what the server endpoint searched: not deleted.
   *
   * `.filter()` runs the scan in JS after the index narrows to this owner's
   * non-deleted notes — there is no way to index "contains", so the index's
   * job here is only to avoid scanning every OTHER user's notes too.
   */
  async search(term: string, ownerId: number): Promise<NoteRow[]> {
    const needle = term.trim().toLowerCase();
    if (needle === '') return [];

    const rows = await db.notes
      .where('[ownerId+deleted]')
      .equals([ownerId, 0])
      .filter(
        (row) =>
          row.content.toLowerCase().includes(needle) ||
          (row.aiTitle ?? '').toLowerCase().includes(needle),
      )
      .toArray();

    return rows.sort(byRecent);
  },

  /** Counts only, on the same compound index as the lists and on `dirty`. */
  async counts(ownerId: number): Promise<NoteCounts> {
    const [all, waiting] = await Promise.all([
      db.notes.where('[ownerId+deleted]').equals([ownerId, 0]).count(),
      db.notes.where('dirty').equals(1).count(),
    ]);
    return { all, waiting };
  },

  getByLocalId(localId: string): Promise<NoteRow | undefined> {
    return db.notes.get(localId);
  },

  getByServerId(serverId: number): Promise<NoteRow | undefined> {
    return db.notes.where('serverId').equals(serverId).first();
  },

  /**
   * Finds a note by the id WE generated.
   *
   * The thread that stops a pull duplicating a note we created offline: the
   * server echoes clientId back, so a row arriving with an unfamiliar serverId
   * can still be recognised as one we already have.
   */
  getByClientId(clientId: string): Promise<NoteRow | undefined> {
    return db.notes.where('clientId').equals(clientId).first();
  },

  /**
   * Rows with local edits the server has not accepted.
   *
   * NOT simply "what Step 8's push reads" (ADR-006). `dirty` is one bit
   * covering two different obligations: an unsent content edit-or-create,
   * which the outbox (8A-8C) owns, and an unsent
   * pin/archive/restore, which 8F's reconnect retry owns instead — the
   * server's SyncOperationType has no room for the latter, deliberately.
   *
   * This method cannot yet tell the two apart, because nothing about a row
   * currently records WHICH kind of change made it dirty — only that
   * something did. 8A's schema needs to answer that before this method's
   * callers can safely split into "push these" and "retry-call these".
   * Do not build 8A's push against this method as-is; it will pick up rows
   * that were never meant to reach the outbox at all.
   */
  listDirty(): Promise<NoteRow[]> {
    return db.notes.where('dirty').equals(1).toArray();
  },
};
