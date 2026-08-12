import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/app/providers/auth-context';
import { useToast } from '@/app/providers/toast-context';
import { noteService } from '@/features/notes/api/noteService';
import { toView, type NoteView } from '@/features/notes/local/noteMappers';
import { noteRepository } from '@/features/notes/local/noteRepository';
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
}

export function useTrash(): TrashStateValue {
  const { state: authState } = useAuth();
  const ownerId =
    authState.status === 'authenticated' || authState.status === 'refreshing'
      ? authState.user.id
      : null;

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

  useEffect(() => {
    if (ownerId === null) return;

    const controller = new AbortController();
    setRefreshing(true);

    noteService
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
   */
  const restore = useCallback(
    async (note: NoteView) => {
      await noteRepository.setDeleted(note.localId, false);

      const written = await noteRepository.getByLocalId(note.localId);
      if (!written) return;

      toast.show({ message: 'Note restored.' });

      // Never created on the server, so there is nothing to restore there.
      if (written.serverId === null) return;

      try {
        const updated = await noteService.restoreNote(written.serverId);
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
        await noteService.permanentlyDeleteNote(row.serverId);
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

  return {
    notes: rows?.map(toView),
    refreshing,
    refreshError,
    refresh,
    restore,
    deleteForever,
  };
}
