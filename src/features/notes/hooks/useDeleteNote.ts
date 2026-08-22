import { useCallback } from 'react';

import { useToast } from '@/app/providers/toast-context';
import { noteService } from '@/features/notes/api/noteService';
import type { NoteView } from '@/features/notes/local/noteMappers';
import { deriveNoteLabel } from '@/features/notes/local/noteLabel';
import { noteRepository, outboxRepository } from '@/features/notes/local/noteRepository';
import { isOffline } from '@/lib/http/errors';

/**
 * Moves a note to the trash, with an undo.
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
      // 1C: no title field — the note domain has none. deriveNoteLabel
      // always returns something (falling back to "New Note"), so there is
      // no "Note moved to trash." fallback case left to special-case here.
      const label = deriveNoteLabel(note.content).label;

      await noteRepository.setDeleted(note.localId, true);

      const written = await noteRepository.getByLocalId(note.localId);

      toast.show({
        message: `“${label}” moved to trash.`,
        action: {
          label: 'Undo',
          onAction: () => {
            toast.dismiss();
            void noteRepository.setDeleted(note.localId, false).then(async () => {
              // A queued DELETE must not survive an undo — see ADR-006 and
              // outboxRepository.cancelPendingDelete for why restore itself
              // stays off the outbox even though this cancellation touches it.
              await outboxRepository.cancelPendingDelete(note.localId);

              if (written?.serverId == null) return;
              // Best-effort. If it fails the row is un-deleted locally and
              // dirty; restore's own reconnect retry (8F) is what reconciles
              // it, same as any other restore.
              await noteService.restoreNote(written.serverId).catch(() => undefined);
            });
          },
        },
      });

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
