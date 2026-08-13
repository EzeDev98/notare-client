import { db } from '@/features/notes/local/database';
import {
  flag,
  fromNoteResponse,
  fromNoteSummary,
  fromTrashedNote,
} from '@/features/notes/local/noteMappers';
import type { NoteRow } from '@/features/notes/local/noteRow';
import { META_KEYS } from '@/features/notes/local/metaRow';
import type { OutboxRow } from '@/features/notes/local/outboxRow';
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
   * Rows a push (8C) or a pull (8D) has flagged as a genuine conflict — a
   * dirty local edit the server has moved past. `syncState` is indexed on
   * its own (schema v1), so this is a direct index lookup, not a scan; the
   * `ownerId` filter runs in memory the same way `search`'s does, since
   * there is no `[ownerId+syncState]` compound index and a user's conflict
   * count is never going to be the thing that makes this slow.
   *
   * Ordered by `byRecent`, same as the trash and for the same reason: a
   * conflict is something that just happened, not something to organise —
   * pinned floating to the top would bury the one that needs attention.
   */
  async listConflicted(ownerId: number): Promise<NoteRow[]> {
    const rows = await db.notes.where('syncState').equals('conflict').toArray();
    return rows.filter((row) => row.ownerId === ownerId).sort(byRecent);
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
    return db.transaction('rw', db.notes, db.outbox, async () => {
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
        // The server just acknowledged this row, cleanly or not — either way
        // a PREVIOUS conflict (8C) is stale the moment a new ack lands, the
        // same reasoning fromNoteResponse uses.
        conflictNote: null,
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

      /*
       * 8B: any queued outbox operation for this note is now stale,
       * regardless of `unchanged`. Either the row is fully clean (the
       * queued copy is obsolete), or it isn't (newer edits exist, and
       * WHATEVER queued content this held is now behind them) — either way,
       * pushing it later would risk overwriting a newer state with an older
       * one, or creating the same note twice. A future offline failure
       * enqueues fresh, from the current row.
       */
      await db.outbox.where('localId').equals(localId).delete();
    });
  },

  /**
   * Records that the server accepted a queued DELETE (8C).
   *
   * Separate from applyServerAck rather than a shared method with a DELETE
   * branch: a DELETE's APPLIED result carries no `note` (there is nothing
   * left on the server to describe), so there is no version or updatedAt to
   * adopt — only the same staleness guard, for the same reason. If the row
   * changed since the request went out (the note was restored while the
   * DELETE was in flight, racing past `cancelPendingDelete`), the row is left
   * exactly as dirty as it already was rather than being marked synced for a
   * delete that no longer reflects local reality.
   */
  applyDeleteAck(localId: string, expectedLocalUpdatedAt: number): Promise<void> {
    return db.transaction('rw', db.notes, db.outbox, async () => {
      const existing = await db.notes.get(localId);
      if (existing) {
        const unchanged = existing.localUpdatedAt === expectedLocalUpdatedAt;
        await db.notes.put({
          ...existing,
          dirty: unchanged ? 0 : existing.dirty,
          syncState: unchanged ? 'synced' : existing.syncState,
        });
      }

      await db.outbox.where('localId').equals(localId).delete();
    });
  },

  /**
   * Records a CONFLICT from a push (8C).
   *
   * Per the architecture doc's contract: "keep the local copy" — so, unlike
   * every other push outcome, the outbox row for this note is left in place
   * by the CALLER (push.ts), not cleared here. This method only stamps the
   * note itself: `syncState: 'conflict'` and the server's copy attached, so
   * 8E has something to show without a follow-up fetch.
   *
   * dirty and localUpdatedAt are untouched — the user's local edit is still
   * exactly as unsent as it was a moment ago; a conflict is news about the
   * SERVER's state, not a local change.
   */
  markConflict(localId: string, theirs: NoteResponse): Promise<void> {
    return db.transaction('rw', db.notes, async () => {
      const existing = await db.notes.get(localId);
      if (!existing) return;

      await db.notes.put({ ...existing, syncState: 'conflict', conflictNote: theirs });
    });
  },

  /**
   * Records an INVALID result from a push (8C).
   *
   * "Do not retry" (architecture doc) means the outbox row is gone — the
   * CALLER (push.ts) removes it, same as every other terminal outcome. This
   * method's job is narrower and just as important: `content` and `title`
   * are NOT touched. The operation was rejected, not the user's text, and
   * "never silently discard the user's text" is the one line in the spec
   * this method exists to honour. The row stays dirty and visible as
   * Unsaved; syncState: 'invalid' is what lets a future screen tell "still
   * saving" apart from "this one needs a human".
   */
  markInvalid(localId: string): Promise<void> {
    return db.transaction('rw', db.notes, async () => {
      const existing = await db.notes.get(localId);
      if (!existing) return;

      await db.notes.put({ ...existing, syncState: 'invalid' });
    });
  },

  /**
   * Rows with local edits the server has not accepted.
   *
   * NOT simply "what Step 8's push reads" (ADR-006). `dirty` is one bit
   * covering two different obligations: an unsent title/content
   * edit-or-create, which the outbox (8A-8C) owns, and an unsent
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

/**
 * The outbox: read access from 8A, write access from 8B.
 *
 * THE INVARIANT EVERY WRITE METHOD HERE MAINTAINS: at most one row per
 * `localId` at any time. The table holds only UNPUSHED operations — a row is
 * removed the moment it is no longer needed, whether because it was applied
 * (8C, later), superseded by a newer local change, or made moot by a direct
 * call succeeding without ever needing the queue. Two rows for the same note
 * would mean the second one's `version` is stale the instant the first is
 * applied, manufacturing a conflict nobody caused — see ADR-006 for the case
 * this was designed to avoid.
 *
 * ONLY CREATE, UPDATE, DELETE are enqueueABLE. Pin, archive, and restore stay
 * off this table entirely, by the same server contract ADR-006 documents —
 * there is no `enqueuePin`, and there should never be one.
 */
export const outboxRepository = {
  list(): Promise<OutboxRow[]> {
    return db.outbox.orderBy('id').toArray();
  },

  listForNote(localId: string): Promise<OutboxRow[]> {
    return db.outbox.where('localId').equals(localId).sortBy('id');
  },

  count(): Promise<number> {
    return db.outbox.count();
  },

  /**
   * Queues a CREATE, or updates the content of one already queued.
   *
   * Called when a save attempt for a note with no serverId fails offline.
   * If this note already has a queued CREATE — a previous offline attempt,
   * or the user kept typing before this attempt's fetch even failed — its
   * title/content are overwritten IN PLACE, same row, same operationId. A
   * second row would violate the one-row invariant for no benefit: only the
   * latest content will ever be worth sending.
   */
  enqueueCreate(note: {
    localId: string;
    clientId: string;
    title: string;
    content: string;
  }): Promise<void> {
    return db.transaction('rw', db.outbox, async () => {
      const existing = await db.outbox.where('localId').equals(note.localId).first();

      if (existing?.type === 'CREATE') {
        await db.outbox.update(existing.id, { title: note.title, content: note.content });
        return;
      }

      // Anything else queued (should not normally occur — defensive, not
      // expected) is superseded: this note has never reached the server, so
      // a CREATE is the only operation that can possibly be correct for it.
      if (existing) {
        await db.outbox.delete(existing.id);
      }

      await db.outbox.add({
        operationId: crypto.randomUUID(),
        type: 'CREATE',
        localId: note.localId,
        clientId: note.clientId,
        noteId: null,
        title: note.title,
        content: note.content,
        version: null,
        queuedAt: Date.now(),
      });
    });
  },

  /**
   * Queues an UPDATE, or updates the content of one already queued.
   *
   * `version` is the LOCAL row's last-server-acknowledged version, which does
   * not change between coalesced edits (it only moves on an ack) — so
   * repeated calls for the same unsent stretch of edits pass the same value
   * every time, and overwriting it on each call is harmless because it is
   * always identical.
   */
  enqueueUpdate(note: {
    localId: string;
    noteId: number;
    version: number | null;
    title: string;
    content: string;
  }): Promise<void> {
    return db.transaction('rw', db.outbox, async () => {
      const existing = await db.outbox.where('localId').equals(note.localId).first();

      if (existing?.type === 'UPDATE') {
        await db.outbox.update(existing.id, { title: note.title, content: note.content });
        return;
      }

      /*
       * A queued CREATE existing here would mean applyServerAck's cleanup
       * (8B) did not run for a note that nonetheless now has a serverId —
       * should not happen, but if it does, UPDATE is what current reality
       * calls for, not the stale CREATE.
       */
      if (existing) {
        await db.outbox.delete(existing.id);
      }

      await db.outbox.add({
        operationId: crypto.randomUUID(),
        type: 'UPDATE',
        localId: note.localId,
        clientId: null,
        noteId: note.noteId,
        title: note.title,
        content: note.content,
        version: note.version,
        queuedAt: Date.now(),
      });
    });
  },

  /**
   * Queues a DELETE, discarding whatever was queued before.
   *
   * ONLY for a note the server already knows about (`noteId` is required and
   * non-null) — a note trashed before ever syncing has nothing to delete on
   * the server; see `discardPendingCreate` for that case instead, which
   * `useDeleteNote` calls on its own early-return branch.
   *
   * A previously queued UPDATE is dropped rather than kept: the note's final
   * state is "deleted," and content it once had does not matter for a
   * soft-delete. A previously queued CREATE should not be possible here —
   * that would mean `noteId` was already known before the note existed on
   * the server — but is handled the same defensive way as the other two
   * methods, for the same reason.
   */
  enqueueDelete(note: { localId: string; noteId: number }): Promise<void> {
    return db.transaction('rw', db.outbox, async () => {
      const existing = await db.outbox.where('localId').equals(note.localId).first();
      if (existing) {
        await db.outbox.delete(existing.id);
      }

      await db.outbox.add({
        operationId: crypto.randomUUID(),
        type: 'DELETE',
        localId: note.localId,
        clientId: null,
        noteId: note.noteId,
        title: null,
        content: null,
        version: null,
        queuedAt: Date.now(),
      });
    });
  },

  /**
   * Drops a queued CREATE for a note trashed before it ever reached the
   * server. Called from `useDeleteNote`'s early return for `serverId ===
   * null` — nothing this note ever queues can be told to a server that has
   * never heard of it, including a CREATE queued by an earlier failed save.
   */
  async discardPendingCreate(localId: string): Promise<void> {
    const existing = await db.outbox.where('localId').equals(localId).first();
    if (existing?.type === 'CREATE') {
      await db.outbox.delete(existing.id);
    }
  },

  /**
   * Cancels a queued DELETE. Called from `restore` (both the trash screen's
   * and the delete toast's Undo) — a note restored before its DELETE ever
   * reached the server must not have that DELETE applied later regardless;
   * the user's restore already reversed the intent it represented.
   */
  async cancelPendingDelete(localId: string): Promise<void> {
    const existing = await db.outbox.where('localId').equals(localId).first();
    if (existing?.type === 'DELETE') {
      await db.outbox.delete(existing.id);
    }
  },

  /**
   * Drops any queued operation for a note once a DIRECT call has already
   * told the server what it needed to know. Called from the editor's
   * create/update success paths and from `applyServerAck` — see the comment
   * there for why this runs unconditionally, not only when the row ends up
   * clean.
   */
  async clearForNote(localId: string): Promise<void> {
    await db.outbox.where('localId').equals(localId).delete();
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
