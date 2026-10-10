import { db } from '@/features/notes/local/database';
import type { OutboxRow } from '@/features/notes/local/outboxRow';
import { notifyLocalMutation } from '@/sync/mutationSignal';

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
   * content is overwritten IN PLACE, same row, same operationId. A second
   * row would violate the one-row invariant for no benefit: only the latest
   * content will ever be worth sending.
   */
  async enqueueCreate(note: { localId: string; clientId: string; content: string }): Promise<void> {
    await db.transaction('rw', db.outbox, async () => {
      const existing = await db.outbox.where('localId').equals(note.localId).first();

      if (existing?.type === 'CREATE') {
        await db.outbox.update(existing.id, { content: note.content });
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
        content: note.content,
        version: null,
        queuedAt: Date.now(),
      });
    });

    // Outside the transaction, deliberately: a listener (engine.ts's
    // debounced trigger) that reacts synchronously must never be able to
    // extend the transaction it fires from — Dexie closes a transaction the
    // moment control leaves it awaiting something the transaction didn't
    // start (Step 7's own callout on this exact surprise).
    notifyLocalMutation();
  },

  /**
   * Queues an UPDATE, or updates the content (and version/noteId) of one
   * already queued.
   *
   * `version` USED TO be treated as invariant across coalesced calls — "it
   * only moves on an ack, so repeated calls for the same unsent stretch of
   * edits pass the same value every time." That is true for the ordinary
   * typing path, but false for conflict resolution: `resolveKeepMine` /
   * `resolveKeepBoth` (sync/conflicts.ts) deliberately call this with a NEW
   * version (the server's, adopted so the requeued push isn't stale against
   * it again) while an OLDER outbox row for the same note already sits here
   * — the exact one that carried the stale version which caused the
   * conflict in the first place (push.ts's CONFLICT branch leaves it queued
   * on purpose, for 8E to resolve). Updating only `content` on the
   * coalescing branch left that stale version in place, so the requeued
   * push resent the same doomed (content, version) pair and the server
   * conflicted again — the resolution never actually stuck. `noteId` is
   * updated too for the same reason, though it should not realistically
   * change once a row has one.
   */
  async enqueueUpdate(note: { localId: string; noteId: number; content: string }): Promise<void> {
    await db.transaction('rw', db.outbox, async () => {
      const existing = await db.outbox.where('localId').equals(note.localId).first();

      if (existing?.type === 'UPDATE') {
        await db.outbox.update(existing.id, {
          content: note.content,
          version: null,
          noteId: note.noteId,
        });
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
        content: note.content,
        version: null,
        queuedAt: Date.now(),
      });
    });

    notifyLocalMutation();
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
  async enqueueDelete(note: { localId: string; noteId: number }): Promise<void> {
    await db.transaction('rw', db.outbox, async () => {
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
        content: null,
        version: null,
        queuedAt: Date.now(),
      });
    });

    notifyLocalMutation();
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

  /**
   * Keeps an ALREADY-QUEUED row's content current as further local edits
   * happen — a no-op if nothing is queued for this note.
   *
   * Called from `setDraft` on EVERY edit, unconditionally, rather than
   * gated on `saveState.status === 'offline'`. That gate looks right but
   * has a real race: `dispatch({ type: 'WENT_OFFLINE' })` and the write
   * this method's caller reacts to both come from the SAME `save()` catch
   * block, but the outbox write (in that catch block) completes and
   * becomes queryable BEFORE React processes the dispatch and updates
   * `saveStateRef.current` on the next render. A second edit landing in
   * that window would read a still-stale 'saving' status, skip the
   * intended direct re-enqueue, and fall back to the scheduler's normal
   * debounced retry — usually harmless (it reaches the same outbox row a
   * moment later), but a needless dependency on render timing for
   * something a plain existence check on the outbox table answers
   * directly, with no window at all.
   */
  async syncQueuedContent(localId: string, content: string): Promise<void> {
    await db.transaction('rw', db.outbox, async () => {
      const existing = await db.outbox.where('localId').equals(localId).first();
      if (!existing) return;
      await db.outbox.update(existing.id, { content });
    });
  },
};
