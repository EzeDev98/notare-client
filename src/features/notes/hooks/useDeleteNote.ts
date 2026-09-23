import { useCallback } from 'react';

import { useToast } from '@/app/providers/toast-context';
import { noteService } from '@/features/notes/api/noteService';
import type { NoteView } from '@/features/notes/local/noteMappers';
import { noteRepository, outboxRepository } from '@/features/notes/local/noteRepository';
import { isOffline } from '@/lib/http/errors';

/**
 * Moves a note to the trash.
 *
 * No in-toast undo any more (product decision, not a regression): the toast
 * is now the same plain "Note moved to trash." used everywhere else a note
 * leaves the current view, with no quoted title and no action link. Getting
 * the note back is still one tap away on the Trash screen's own Restore
 * button (useTrash's `restore`), which is the same setDeleted(false) +
 * cancelPendingDelete + restoreNote sequence this hook used to run from the
 * toast's Undo handler.
 *
 * The `onRemove` callback is gone for the same reason it went from
 * useNoteActions: the list is a live query, so setting `deleted` on the row
 * removes the note from every view that filters on it. The old hook's most
 * delicate behaviour — "reinsert at the original index on undo" — is gone with
 * it, because the row never leaves the table.
 *
 * 7E SETTLES THE STAMP. setDeleted DOES restamp localUpdatedAt (an earlier
 * version of this comment claimed otherwise), so a note deleted and then undone
 * comes back at the TOP of the list rather than where it was. That is
 * deliberate, and the alternative is worse: applyServerAck's guard compares the
 * stamp taken before a request against the row after it, and a mutation that
 * does not move the stamp is a mutation the guard cannot see — a delete
 * acknowledged after an undo would mark the undone row clean and it would never
 * be pushed. The list order is the cheaper thing to give up, and "the note you
 * just touched is at the top" is defensible on its own terms. The trash orders
 * by the same stamp, which is exactly what that screen wants: most recently
 * trashed first.
 *
 * ORDER: local write first, request second. That was already true, but it used
 * to be a UX choice with a rollback behind it. Now it is the architecture —
 * the local write is the operation, and the request only informs the server.
 *
 * 8B: DELETE is a real outbox operation (unlike restore — see ADR-006), so an
 * offline failure here queues one, rather than merely leaving the row dirty
 * with nothing to retry it.
 */
export function useDeleteNote() {
  const toast = useToast();

  return useCallback(
    async (note: NoteView) => {
      // Same fixed 18-character cutoff as Archived and Trash (NoteCard's

      await noteRepository.setDeleted(note.localId, true);

      const written = await noteRepository.getByLocalId(note.localId);

      toast.show({ message: 'Note moved to trash.' });

      if (written?.serverId == null) {
        /*
         * Never created on the server, so there is nothing to soft-delete
         * there. The row is a local tombstone.
         *
         * 8B: also drop a queued CREATE if one exists — an earlier offline
         * save attempt may have queued one, and there is nothing left for it
         * to create now that this note is trashed.
         */
        await outboxRepository.discardPendingCreate(note.localId);
        return;
      }

      try {
        await noteService.softDeleteNote(written.serverId);
        await noteRepository.applyServerAck(
          note.localId,
          { version: note.version, updatedAt: note.updatedAt },
          written.localUpdatedAt,
        );
      } catch (error) {
        if (isOffline(error)) {
          await outboxRepository.enqueueDelete({ localId: note.localId, noteId: written.serverId });
        }
        // Otherwise: the note is in the local trash and dirty. It is not
        // lost, and the user's action stands — telling them it failed would
        // be misleading. A non-offline failure has no retry path yet; that
        // gap is pre-existing and unrelated to 8B.
      }
    },
    [toast],
  );
}