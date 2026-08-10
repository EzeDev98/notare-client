import { useCallback } from 'react';

import { useToast } from '@/app/providers/toast-context';
import { noteService } from '@/features/notes/api/noteService';
import type { NoteView } from '@/features/notes/local/noteMappers';
import { noteRepository } from '@/features/notes/local/noteRepository';

/**
 * Moves a note to the trash, with an undo.
 *
 * The `onRemove` callback is gone for the same reason it went from
 * useNoteActions: the list is a live query, so setting `deleted` on the row
 * removes the note from every view that filters on it. The old hook's most
 * delicate behaviour — "reinsert at the original index on undo" — is now a
 * property of the sort order rather than code, because the row never left the
 * table and localUpdatedAt is deliberately not restamped by setDeleted.
 *
 * ORDER: local write first, request second. That was already true, but it used
 * to be a UX choice with a rollback behind it. Now it is the architecture —
 * the local write is the operation, and the request only informs the server.
 */
export function useDeleteNote() {
  const toast = useToast();

  return useCallback(
    async (note: NoteView) => {
      const label = note.title.trim();

      await noteRepository.setDeleted(note.localId, true);

      const written = await noteRepository.getByLocalId(note.localId);

      toast.show({
        message: label === '' ? 'Note moved to trash.' : `“${label}” moved to trash.`,
        action: {
          label: 'Undo',
          onAction: () => {
            toast.dismiss();
            void noteRepository.setDeleted(note.localId, false).then(async () => {
              if (written?.serverId == null) return;
              // Best-effort. If it fails the row is un-deleted locally and
              // dirty, which Step 8 reconciles.
              await noteService.restoreNote(written.serverId).catch(() => undefined);
            });
          },
        },
      });

      if (written?.serverId == null) {
        /*
         * Never created on the server, so there is nothing to soft-delete
         * there. The row is a local tombstone; Step 8 decides whether it is
         * pushed as a delete or simply dropped, since the server has never
         * heard of this note.
         */
        return;
      }

      try {
        await noteService.softDeleteNote(written.serverId);
        await noteRepository.applyServerAck(
          note.localId,
          { version: note.version, updatedAt: note.updatedAt },
          written.localUpdatedAt,
        );
      } catch {
        // The note is in the local trash and dirty. It is not lost, and the
        // user's action stands — telling them it failed would be misleading.
      }
    },
    [toast],
  );
}
