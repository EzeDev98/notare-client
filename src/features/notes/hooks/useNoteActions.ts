import { useCallback } from 'react';

import { useToast } from '@/app/providers/toast-context';
import { noteService } from '@/features/notes/api/noteService';
import { flag, type NoteView } from '@/features/notes/local/noteMappers';
import { noteRepository } from '@/features/notes/local/noteRepository';

/**
 * Pin and archive, LOCAL-FIRST.
 *
 * The shape of this hook changed completely in 7D, and the deletion is the
 * interesting part: it used to take `onUpdated` and `onRemoved` callbacks so
 * the caller could patch its own copy of the list. Both are gone.
 *
 * WHY THEY COULD GO. Before 7C the list lived in React state, so a mutation
 * had to be told where to write. Now the list is a useLiveQuery over Dexie:
 * write the row and every subscriber re-renders, including other tabs. The
 * callbacks were plumbing around the absence of a database, and once there is
 * one they are not simplification, they are duplication — a second source of
 * truth that can disagree with the first.
 *
 * WHAT THIS BUYS. Pin and archive now work OFFLINE. The local write is the
 * real one; the request is an attempt to tell the server about it. If it
 * fails, or if the note has no serverId because it was created offline, the
 * row simply stays dirty.
 *
 * NOT Step 8's outbox (ADR-006). The server's SyncOperationType deliberately
 * excludes pin and archive — nobody queues one for later, by design on the
 * server, not by omission here. A failed pin is retried by calling THIS
 * SAME endpoint again on reconnection, which is 8F's job, not the batch
 * push's.
 *
 * WHAT IS STILL MISSING. Nothing retries yet. A failed pin is dirty and
 * correct locally, but nothing calls setPinned again until 8F exists. That is
 * a known gap, not an oversight — see ADR-006.
 */
export function useNoteActions() {
  const toast = useToast();

  const togglePin = useCallback(
    async (note: NoteView) => {
      const next = !note.pinned;

      /*
       * The local write IS the optimistic update. There is no separate
       * "optimistic" concept any more — the UI renders Dexie, so writing to
       * Dexie is how the screen changes. A rollback path is not needed either:
       * if the request fails the row is already correct, just unsynced.
       */
      await noteRepository.applyLocalEdit(note.localId, { pinned: flag(next) });

      // Read back the stamp the write just set, so the ack can tell whether
      // anything moved while the request was in flight.
      const written = await noteRepository.getByLocalId(note.localId);
      if (!written) return;

      /*
       * No serverId means the note has never been created on the server.
       * There is nothing to PATCH.
       *
       * OPEN EDGE CASE, flagged for 8A rather than resolved here:
       * SyncOperationRequest's CREATE carries only title/content, so a note
       * pinned entirely offline before its first sync has nowhere to carry
       * that flag through CREATE either. Left as-is is a silent data loss on
       * first sync, not merely a delay. 8A needs to either add the flags to
       * CREATE's payload or have 8F re-send this pin once the row gets a
       * serverId — deciding which is 8A's job, not this hook's.
       */
      if (written.serverId === null) return;

      try {
        const updated = await noteService.setPinned(written.serverId, next);
        await noteRepository.applyServerAck(
          note.localId,
          { version: updated.version, updatedAt: updated.updatedAt },
          written.localUpdatedAt,
        );
      } catch {
        /*
         * Deliberately quiet. The user's intent is recorded locally and
         * visible on screen; a toast saying "could not pin" would be telling
         * them something failed when from their point of view it worked. The
         * unsynced state is communicated by the note's own "Unsaved" badge,
         * which is the honest place for it (§38 — do not overuse toasts).
         */
      }
    },
    // toast is not a dependency: the happy and failure paths no longer raise
    // one. Kept in scope because archive below still does.
    [],
  );

  const setArchived = useCallback(
    async (note: NoteView, archived: boolean) => {
      await noteRepository.applyLocalEdit(note.localId, { archived: flag(archived) });

      const written = await noteRepository.getByLocalId(note.localId);
      if (!written) return;

      /*
       * Archive DOES get a toast, and pin does not, because archive removes
       * the note from the list the user is looking at. Something left the
       * screen, so there has to be a way back. Pin changes a badge in place —
       * the feedback is the badge.
       */
      toast.show({
        message: archived ? 'Note archived.' : 'Note moved back to your notes.',
        action: {
          label: 'Undo',
          onAction: () => {
            toast.dismiss();
            // Undo is a local write like any other, so it is instant and works
            // offline. No request is issued here; the reconciliation below
            // will have left the row dirty either way.
            void noteRepository.applyLocalEdit(note.localId, { archived: flag(!archived) });
          },
        },
      });

      if (written.serverId === null) return;

      try {
        const updated = await noteService.setArchived(written.serverId, archived);
        await noteRepository.applyServerAck(
          note.localId,
          { version: updated.version, updatedAt: updated.updatedAt },
          written.localUpdatedAt,
        );
      } catch {
        // Same reasoning as pin: the local state is right, it is merely
        // unsent.
      }
    },
    [toast],
  );

  return { togglePin, setArchived };
}
