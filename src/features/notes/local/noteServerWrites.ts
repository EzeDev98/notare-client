import { db } from '@/features/notes/local/database';
import {
  flag,
  fromNoteResponse,
  fromNoteSummary,
  isSameRow,
  syncStateFor,
} from '@/features/notes/local/noteMappers';
import type { NoteResponse, NoteSummaryResponse } from '@/features/notes/types';
import type { ServerDateTime } from '@/lib/http/types';
import { notifyLocalMutation } from '@/sync/mutationSignal';

/**
 * Writes that come from the server (step 8c): acknowledgements of what we
 * pushed, and notes and summaries we pulled.
 *
 * A dirty row (unsent local edits) is never overwritten by a server copy.
 */
export const noteServerWrites = {
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
  async applyServerAck(
    localId: string,
    ack: { version: number | null; updatedAt: ServerDateTime | null; serverId?: number },
    expectedLocalUpdatedAt: number,
  ): Promise<void> {
    const requeued = await db.transaction('rw', db.notes, db.outbox, async () => {
      const existing = await db.notes.get(localId);
      if (!existing) return false;

      const unchanged = existing.localUpdatedAt === expectedLocalUpdatedAt;
      const serverId = ack.serverId ?? existing.serverId;
      // Clean only if nothing moved AND the server has the note (step 8g).
      const clean = unchanged && serverId !== null;

      await db.notes.put({
        ...existing,
        serverId,
        version: ack.version,
        updatedAt: ack.updatedAt,
        dirty: clean ? 0 : 1,
        syncState: syncStateFor(serverId, clean),
        // The server took a change from us, so the note is no longer as AI tidy left it.
        restorable: false,
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

      /*
       * Step 8f: nothing else re-sends an edit made while this request was in
       * flight (the autosave timer that used to is gone). The row is still
       * dirty, so queue its newest text as an UPDATE now that it has a server id.
       */
      if (clean || serverId === null || existing.deleted === 1) return false;

      await db.outbox.add({
        operationId: crypto.randomUUID(),
        type: 'UPDATE',
        localId,
        clientId: null,
        noteId: serverId,
        content: existing.content,
        version: null,
        queuedAt: Date.now(),
      });
      return true;
    });

    // Outside the transaction, same reason as outboxRepository.enqueueCreate.
    if (requeued) notifyLocalMutation();
  },

  /**
   * Records an INVALID result from a push (8C).
   *
   * "Do not retry" (architecture doc) means the outbox row is gone — the
   * CALLER (push.ts) removes it, same as every other terminal outcome. This
   * method's job is narrower and just as important: `content` is NOT
   * touched. The operation was rejected, not the user's text, and
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
       * no clientId field — only the pull response's SyncChangedEntry wrapper
       * carries it (types.ts). Step 8 adds a
       * separate path that can match on it, and comparing against a stringified
       * server id here would be a lookup that never matches anything.
       */
      const existing = await db.notes.where('serverId').equals(note.id).first();

      if (!existing) {
        await db.notes.put(fromNoteResponse(note));
        return 'inserted';
      }

      if (existing.dirty === 1) return 'skipped';

      // A clean row whose server fields are byte-identical to what we
      // already have gets no write. Opening a synced note re-fetches it
      // (useNote.ts) on every mount, and db.notes.put — even with values
      // that end up equal — is still a real IndexedDB write, which fires
      // every useLiveQuery watching this table. The whole sidebar list
      // re-renders on every note click, recomputing each row's relative
      // "X minutes/seconds ago" label against the current instant even
      // though nothing about any note actually changed — the read looks
      // like a mutation to anything downstream. Comparing first makes a
      // no-op open a genuine no-op, list included.
      const noChange =
        existing.content === (note.content ?? '') &&
        existing.pinned === flag(note.pinned) &&
        existing.version === note.version &&
        existing.createdAt === note.createdAt &&
        existing.updatedAt === note.updatedAt &&
        existing.ownerId === note.ownerId &&
        existing.lastModifiedBy === note.lastModifiedBy;
      if (noChange) return 'skipped';

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
        // all — fromNoteSummary preserves content, but overwriting version on
        // a row with unsent edits would lose it.
        if (existing?.dirty === 1) continue;

        const next = fromNoteSummary(summary, ownerId, existing);
        if (existing && isSameRow(existing, next)) continue;

        await db.notes.put(next);
      }
    });
  },
};
