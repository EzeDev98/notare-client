import { sessionUserOf } from '@/features/auth/sessionUser';
import { useStableLiveQuery as useLiveQuery } from '@/shared/hooks/useStableLiveQuery';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/app/providers/auth-context';
import { useToast } from '@/app/providers/toast-context';
import { gateway } from '@/core/adapter';
import { toView, type NoteView } from '@/features/notes/local/noteMappers';
import { noteRepository, outboxRepository } from '@/features/notes/local/noteRepository';
import { isAborted } from '@/lib/http/errors';

const PAGE_SIZE = 100;

/**
 * The trash, read from LOCAL STORAGE (7E).
 *
 * The last screen that still treated the network as the source of truth. It is
 * the same inversion useNotes went through in 7C, and the trash is where it
 * matters most for a reason that is easy to miss: a note deleted offline was
 * already gone from the notes list — with a server-only trash it was gone from
 * BOTH screens, so the user had no way to see it, let alone undo it. Deleting
 * offline meant the note vanished entirely until a sync that does not exist yet.
 *
 * WHAT CHANGED IN SHAPE. The old hook kept the list in React state and patched
 * it after every action (`remove(noteId)` before each request, `reload()` on
 * failure). All of that is gone. The row never leaves the table — `deleted` is
 * a flag — so restoring is one write and the live queries on both screens
 * re-run: the note disappears from the bin and reappears in the notes list
 * without either screen knowing the other exists.
 *
 * IDENTITY: notes are addressed by localId, not by server id. A note created
 * offline and then trashed has no server id at all, and the previous signature
 * (noteId: number) could not describe it.
 */
export interface TrashStateValue {
  /** Undefined while Dexie is still answering — NOT the same as an empty bin. */
  notes: NoteView[] | undefined;
  /** A background refresh is in flight. Content may already be on screen. */
  refreshing: boolean;
  /** The last refresh failed. Local rows are still shown. */
  refreshError: string | null;
  refresh: () => void;
  restore: (note: NoteView) => Promise<void>;
  deleteForever: (note: NoteView) => Promise<void>;
  /**
   * Same operation as `deleteForever`, run across many notes at once —
   * the Trash screen's own "Delete forever" bulk action, for clearing out
   * a large bin without confirming and waiting on each note one at a time.
   *
   * Bounded concurrency (see CONCURRENCY below), not one request per note
   * fired at once: a bin of a hundred notes would otherwise open a hundred
   * simultaneous DELETE requests, which is both an unfriendly thing to do
   * to the server and, in most browsers, throttled to ~6 in-flight
   * requests per host anyway — the rest would simply queue behind those,
   * for no benefit over queueing them here on purpose.
   *
   * Never throws: every note's outcome is captured individually
   * (Promise.allSettled) so one failure cannot abort the rest of the
   * batch, and the summary toast reports how many succeeded and how many
   * did not, mirroring `deleteForever`'s own honest, no-optimistic-UI
   * stance on a genuinely irreversible action.
   */
  deleteManyForever: (notes: NoteView[]) => Promise<void>;
}

/** In-flight requests this batch allows at once. See deleteManyForever's doc comment. */
const DELETE_FOREVER_CONCURRENCY = 6;

/**
 * Runs `task` over every item in `items`, at most `limit` at a time,
 * resolving once every task has settled (success or failure alike).
 */
async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<void>,
): Promise<PromiseSettledResult<void>[]> {
  const results: PromiseSettledResult<void>[] = new Array(
    items.length,
  ) as PromiseSettledResult<void>[];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        await task(items[index]!);
        results[index] = { status: 'fulfilled', value: undefined };
      } catch (error) {
        results[index] = { status: 'rejected', reason: error };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));

  return results;
}

export function useTrash(): TrashStateValue {
  const { state: authState } = useAuth();
  const ownerId = sessionUserOf(authState)?.id ?? null;

  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const refresh = useCallback(() => {
    setRefreshToken((n) => n + 1);
  }, []);

  const rows = useLiveQuery(async () => {
    if (ownerId === null) return [];
    return noteRepository.listTrashed(ownerId);
  }, [ownerId]);

  // Memoised: a fresh array every render (e.g. when `refreshing` toggles after a
  // network response) makes list components re-measure and re-animate.
  const notes = useMemo(() => rows?.map(toView), [rows]);

  useEffect(() => {
    if (ownerId === null) return;

    const controller = new AbortController();
    setRefreshing(true);

    gateway
      .listTrash({ page: 0, size: PAGE_SIZE, signal: controller.signal })
      .then(async (page) => {
        await noteRepository.upsertTrashedNotes(page.content, ownerId);
        setRefreshError(null);
      })
      .catch((error: unknown) => {
        if (isAborted(error)) return;
        setRefreshError('Could not reach Notare. Showing what is in your trash on this device.');
      })
      .finally(() => {
        setRefreshing(false);
      });

    return () => {
      controller.abort();
    };
  }, [ownerId, refreshToken]);

  /**
   * Restore: LOCAL FIRST, exactly like pin and archive (7D).
   *
   * Clearing the flag is the operation; the request only informs the server. It
   * therefore works offline, and a failure needs no rollback — the row is
   * already correct, merely unsent.
   *
   * NOT Step 8's outbox (ADR-006). Restore is excluded from
   * SyncOperationType by the same deliberate server decision as pin and
   * archive. A failed restore is retried by calling restoreNote again on
   * reconnection — 8F's job, not the batch push's.
   *
   * IT DOES TOUCH THE OUTBOX ONCE, though (8B): if this note has a queued
   * DELETE from an offline trash that never reached the server, restoring it
   * must cancel that DELETE — otherwise a later push would trash a note the
   * user explicitly brought back. That is queue hygiene, not restore joining
   * the outbox.
   */
  const restore = useCallback(
    async (note: NoteView) => {
      await noteRepository.setDeleted(note.localId, false);
      await outboxRepository.cancelPendingDelete(note.localId);

      const written = await noteRepository.getByLocalId(note.localId);
      if (!written) return;

      toast.show({ message: 'Note restored.' });

      // Never created on the server, so there is nothing to restore there.
      if (written.serverId === null) return;

      try {
        const updated = await gateway.restoreNote(written.serverId);
        await noteRepository.applyServerAck(
          note.localId,
          { version: updated.version, updatedAt: updated.updatedAt },
          written.localUpdatedAt,
        );
      } catch {
        /*
         * Quiet, for the same reason pin is quiet: from the user's point of
         * view the restore worked, because it did. The note is back in their
         * notes list and the row is dirty. Saying "could not restore" would be
         * describing the network, not their note.
         */
      }
    },
    [toast],
  );

  /**
   * Permanent delete: SERVER FIRST. The deliberate exception to local-first.
   *
   * Every other write in this app is local-first because the local row can hold
   * the intent until the server hears about it. This one cannot. There is no
   * "pending permanent delete" state — the row's whole job is to represent a
   * note, and the operation's job is to stop the note existing. Deleting the row
   * optimistically and failing the request would remove the note from this
   * device while it lives on every other one, and the next list refresh would
   * bring it back with no explanation.
   *
   * So the server decides, and offline this action honestly fails. It is
   * irreversible and there is no undo to offer; a false success would be the
   * worst possible lie here.
   *
   * A note with no serverId is the one case that IS purely local: the server has
   * never heard of it, so dropping the row completes the operation.
   */
  const deleteForever = useCallback(
    async (note: NoteView) => {
      const row = await noteRepository.getByLocalId(note.localId);
      if (!row) return;

      if (row.serverId === null) {
        await noteRepository.hardDelete(note.localId);
        toast.show({ message: 'Note deleted permanently.' });
        return;
      }

      try {
        await gateway.purgeNote(row.serverId);
      } catch {
        toast.show({ message: 'Could not delete that note. You need a connection for this.' });
        return;
      }

      /*
       * hardDelete, not setDeleted. The row is not a tombstone: the server has
       * forgotten this note, so a local row could never be reconciled with
       * anything. Keeping it would leave a permanently unmatchable ghost in
       * every sync.
       */
      await noteRepository.hardDelete(note.localId);
      // NO undo offered, because there is none. Any affordance suggesting
      // otherwise would be a lie.
      toast.show({ message: 'Note deleted permanently.' });
    },
    [toast],
  );

  /**
   * See TrashStateValue.deleteManyForever's own doc comment for the
   * concurrency reasoning. Per-note logic is intentionally the same as
   * `deleteForever` above (server-first for a synced note, purely local
   * for one that never reached the server) — duplicated rather than
   * having one call the other in a loop, since `deleteForever` shows its
   * own toast per note and this needs exactly one summary toast for the
   * whole batch instead.
   */
  const deleteManyForever = useCallback(
    async (selected: NoteView[]) => {
      if (selected.length === 0) return;

      const results = await mapWithConcurrency(
        selected,
        DELETE_FOREVER_CONCURRENCY,
        async (note) => {
          const row = await noteRepository.getByLocalId(note.localId);
          if (!row) return;

          if (row.serverId !== null) {
            await gateway.purgeNote(row.serverId);
          }

          // hardDelete, not setDeleted — same reasoning as deleteForever's
          // own comment: a server-forgotten note can never be reconciled,
          // so the local row would only linger as a ghost.
          await noteRepository.hardDelete(note.localId);
        },
      );

      const failedCount = results.filter((result) => result.status === 'rejected').length;
      const succeededCount = results.length - failedCount;

      if (failedCount === 0) {
        toast.show({
          message:
            succeededCount === 1
              ? 'Note deleted permanently.'
              : `${String(succeededCount)} notes deleted permanently.`,
        });
        return;
      }

      if (succeededCount === 0) {
        toast.show({ message: 'Could not delete those notes. You need a connection for this.' });
        return;
      }

      toast.show({
        message: `${String(succeededCount)} notes deleted, ${String(failedCount)} could not be deleted. You need a connection for this.`,
      });
    },
    [toast],
  );

  return {
    notes,
    refreshing,
    refreshError,
    refresh,
    restore,
    deleteForever,
    deleteManyForever,
  };
}
