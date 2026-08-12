import { db } from '@/features/notes/local/database';
import {
  flag,
  fromNoteResponse,
  fromNoteSummary,
  fromTrashedNote,
} from '@/features/notes/local/noteMappers';
import type { NoteRow } from '@/features/notes/local/noteRow';
import { META_KEYS } from '@/features/notes/local/metaRow';
import type {
  NoteResponse,
  NoteSummaryResponse,
  TrashedNoteResponse,
} from '@/features/notes/types';
import type { ServerDateTime } from '@/lib/http/types';

/**
 * Every query and write against the local notes table.
 *
 * Not ceremony over db.notes — three things it prevents:
 *
 *   ENCODING LEAKS. 7A settled that flags are 0 | 1 for IndexedDB and boolean
 *   for the UI. A caller writing where('deleted').equals(false) gets an empty
 *   result with no error, forever.
 *
 *   UNBOUNDED WRITES. Reconciling a pull is read-merge-write, and outside a
 *   transaction a concurrent editor write between the read and the write is
 *   silently lost.
 *
 *   UNNAMED QUERIES. where('[ownerId+deleted+archived]').equals([1, 0, 0])
 *   does not explain itself, and the index it depends on is invisible from the
 *   call site.
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
 * The trash uses this rather than byPinnedThenRecent. Pinning is an
 * organisation of the notes you are working with, and a bin is not that — a
 * pinned note floating above the top of the trash tells the user nothing and
 * pushes the thing they just deleted, which is what they came to look at, down
 * the list. Since setDeleted restamps localUpdatedAt, "most recent" here means
 * "most recently trashed", which is the order this screen wants.
 */
function byRecent(a: NoteRow, b: NoteRow): number {
  return b.localUpdatedAt - a.localUpdatedAt;
}

/**
 * Ranks a title match above a content-only match, then falls back to recency.
 *
 * `needle` is already lower-cased by the caller — done once per search
 * rather than once per comparison.
 *
 * Content-only results are not excluded, but a note whose TITLE contains the
 * term is what a user typing a word is almost always looking for, and burying
 * it under a dozen notes that merely mention the word in passing would make
 * the ranking feel broken even though every result is technically correct.
 */
function bySearchRank(needle: string) {
  return (a: NoteRow, b: NoteRow): number => {
    const aTitleMatch = a.title.toLowerCase().includes(needle);
    const bTitleMatch = b.title.toLowerCase().includes(needle);
    if (aTitleMatch !== bTitleMatch) return aTitleMatch ? -1 : 1;
    return b.localUpdatedAt - a.localUpdatedAt;
  };
}

export const noteRepository = {
  /** The main list: mine, not trashed, not archived. */
  async listActive(ownerId: number): Promise<NoteRow[]> {
    const rows = await db.notes
      .where('[ownerId+deleted+archived]')
      .equals([ownerId, 0, 0])
      .toArray();
    return rows.sort(byPinnedThenRecent);
  },

  async listArchived(ownerId: number): Promise<NoteRow[]> {
    const rows = await db.notes
      .where('[ownerId+deleted+archived]')
      .equals([ownerId, 0, 1])
      .toArray();
    return rows.sort(byPinnedThenRecent);
  },

  /**
   * The trash. Both archived states, because a note can be archived AND
   * trashed — they are orthogonal flags (Step 1's decision), so filtering on
   * one would hide half the bin.
   */
  async listTrashed(ownerId: number): Promise<NoteRow[]> {
    const rows = await db.notes
      .where('[ownerId+deleted+archived]')
      .anyOf([
        [ownerId, 1, 0],
        [ownerId, 1, 1],
      ])
      .toArray();
    return rows.sort(byRecent);
  },

  /**
   * Searches title and content, locally. (7G)
   *
   * A SUBSTRING SCAN, not an inverted index. This is one person's own notes,
   * not a search engine over a shared corpus — the realistic dataset size
   * does not justify tokenisation, index maintenance on every keystroke, and
   * a second copy of every note's words. If someone's note count ever makes
   * this slow, that is the moment to build an index, not before.
   *
   * SCOPE matches what the server endpoint searched: not deleted, archived or
   * not — the same `anyOf` shape `listTrashed` already uses for "both
   * archived states", here for the opposite pair.
   *
   * `.filter()` runs the scan in JS after the index narrows to this owner's
   * non-deleted notes — there is no way to index "contains", so the index's
   * job here is only to avoid scanning every OTHER user's notes too.
   */
  async search(term: string, ownerId: number): Promise<NoteRow[]> {
    const needle = term.trim().toLowerCase();
    if (needle === '') return [];

    const rows = await db.notes
      .where('[ownerId+deleted+archived]')
      .anyOf([
        [ownerId, 0, 0],
        [ownerId, 0, 1],
      ])
      .filter(
        (row) => row.title.toLowerCase().includes(needle) || row.content.toLowerCase().includes(needle),
      )
      .toArray();

    return rows.sort(bySearchRank(needle));
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
  applyLocalEdit(
    localId: string,
    changes: Partial<Pick<NoteRow, 'title' | 'content' | 'pinned' | 'archived'>>,
  ): Promise<void> {
    return db.transaction('rw', db.notes, async () => {
      const existing = await db.notes.get(localId);
      if (!existing) return;

      await db.notes.put({
        ...existing,
        ...changes,
        dirty: 1,
        syncState: existing.syncState === 'conflict' ? 'conflict' : 'pending',
        localUpdatedAt: Date.now(),
      });
    });
  },

  /** Soft delete: the row stays, so a restore is local and instant. */
  setDeleted(localId: string, deleted: boolean): Promise<void> {
    return db.transaction('rw', db.notes, async () => {
      const existing = await db.notes.get(localId);
      if (!existing) return;

      await db.notes.put({
        ...existing,
        deleted: flag(deleted),
        dirty: 1,
        syncState: 'pending',
        localUpdatedAt: Date.now(),
      });
    });
  },

  /**
   * Records that the server accepted a local change.
   *
   * THE GUARD IS THE WHOLE POINT. Between the local write and the server's
   * reply the user may have edited again, and clearing `dirty` unconditionally
   * would mark those newer edits as saved — they would never be pushed, and
   * the loss is silent and permanent.
   *
   * `expectedLocalUpdatedAt` is the stamp the row carried when the request went
   * out. If it still matches, nothing happened while we waited and the row is
   * genuinely clean. If it does not, we take the server's version (needed, or
   * the next write 409s) and LEAVE the row dirty for Step 8 to push.
   *
   * This is the same optimistic-concurrency idea as the server's @Version,
   * applied in the other direction: a token read before the write, compared
   * after it, to detect that someone else moved underneath you.
   */
  applyServerAck(
    localId: string,
    ack: { version: number | null; updatedAt: ServerDateTime | null; serverId?: number },
    expectedLocalUpdatedAt: number,
  ): Promise<void> {
    return db.transaction('rw', db.notes, async () => {
      const existing = await db.notes.get(localId);
      if (!existing) return;

      const unchanged = existing.localUpdatedAt === expectedLocalUpdatedAt;

      await db.notes.put({
        ...existing,
        serverId: ack.serverId ?? existing.serverId,
        version: ack.version,
        updatedAt: ack.updatedAt,
        dirty: unchanged ? 0 : 1,
        syncState: unchanged ? 'synced' : 'pending',
        /*
         * localUpdatedAt is NOT restamped HERE. An acknowledgement is not a
         * local change — the server agreeing with us is not the user doing
         * something — and on the changed branch, restamping would destroy the
         * very evidence the next ack needs to compare against.
         *
         * The local write that preceded this one DID restamp, which 7E settled
         * deliberately: every local mutation must move the stamp or this guard
         * cannot see it. The cost is that pinning, archiving and deleting all
         * reorder the list, which is a smaller price than a silently unsent
         * write.
         */
      });
    });
  },

  /** Rows with local edits the server has not accepted. Step 8's push reads this. */
  listDirty(): Promise<NoteRow[]> {
    return db.notes.where('dirty').equals(1).toArray();
  },

  /**
   * Applies a server note to local storage.
   *
   * RETURNS WHAT IT DID rather than silently choosing, because the dirty case
   * is a policy decision and this layer does not own it:
   *
   *   'inserted' | 'updated' — the local row was clean, the server wins
   *   'skipped'              — the local row has unsent edits
   *
   * 7F decides what 'skipped' means (conflict, or local-wins, or merge). Doing
   * that here would bury the most consequential decision in the layer least
   * able to explain it.
   *
   * Matched by serverId FIRST, then clientId — a note we created offline is
   * found by the id we generated, before it has a server id we could match on.
   */
  upsertFromServer(note: NoteResponse): Promise<'inserted' | 'updated' | 'skipped'> {
    return db.transaction('rw', db.notes, async () => {
      /*
       * Matched by serverId only.
       *
       * clientId matching belongs to the SYNC pull, not here: NoteResponse has
       * no clientId field — only SyncNoteResponse carries it. Step 8 adds a
       * separate path that can match on it, and comparing against a stringified
       * server id here would be a lookup that never matches anything.
       */
      const existing = await db.notes.where('serverId').equals(note.id).first();

      if (!existing) {
        await db.notes.put(fromNoteResponse(note));
        return 'inserted';
      }

      if (existing.dirty === 1) return 'skipped';

      await db.notes.put(fromNoteResponse(note, existing));
      return 'updated';
    });
  },

  /**
   * Applies a page of list summaries.
   *
   * ONE transaction for the whole page, not one per row. A page is a single
   * observation of the server's state, and committing it row by row leaves a
   * window where the list is half-old and half-new — which useLiveQuery would
   * happily render.
   */
  upsertSummaries(summaries: NoteSummaryResponse[], ownerId: number | null): Promise<void> {
    return db.transaction('rw', db.notes, async () => {
      for (const summary of summaries) {
        const existing = await db.notes.where('serverId').equals(summary.id).first();

        // A summary carries no content, so a dirty row must not be touched at
        // all — fromNoteSummary preserves content, but overwriting title and
        // version on a row with unsent edits would lose them.
        if (existing?.dirty === 1) continue;

        await db.notes.put(fromNoteSummary(summary, ownerId, existing));
      }
    });
  },

  /**
   * Applies a page of the server's trash.
   *
   * Same shape as upsertSummaries and deliberately a SEPARATE method rather
   * than a flag on it: the two write opposite values for `deleted`, and a
   * boolean parameter at the call site would read as configuration when it is
   * actually the difference between "this note is in your notes" and "this note
   * is in your bin".
   *
   * Dirty rows are skipped for a sharper reason than in the notes list. A row
   * is dirty here mainly because the user just RESTORED it and the server has
   * not been told yet; letting a trash page that was fetched before that write
   * land on top would put the note straight back in the bin in front of them.
   *
   * WHAT THIS DOES NOT DO: remove local rows the server no longer lists as
   * trashed. A note restored or permanently deleted on another device stays in
   * this device's bin until something tells us otherwise. Reconciling absence
   * needs tombstones and a cursor, which is Step 8's pull — inventing a weaker
   * version here (delete anything not in the page) would wrongly evict every
   * note beyond the first page.
   */
  upsertTrashedNotes(trashed: TrashedNoteResponse[], ownerId: number | null): Promise<void> {
    return db.transaction('rw', db.notes, async () => {
      for (const entry of trashed) {
        const existing = await db.notes.where('serverId').equals(entry.note.id).first();

        if (existing?.dirty === 1) continue;

        await db.notes.put(fromTrashedNote(entry, ownerId, existing));
      }
    });
  },

  /** Removes a row entirely. For a permanent delete, or evicting a tombstone. */
  hardDelete(localId: string): Promise<void> {
    return db.notes.delete(localId);
  },

  async clear(): Promise<void> {
    await db.notes.clear();
  },
};

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
