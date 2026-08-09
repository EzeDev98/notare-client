import { useCallback } from 'react';

import { useToast } from '@/app/providers/toast-context';
import { noteService } from '@/features/notes/api/noteService';

interface DeleteHandlers {
  /**
   * Called before the request, to remove the note from view. Returns how to
   * put it back.
   *
   * The two callers differ ONLY here: the list drops a row and reinserts it at
   * its original index; the detail view navigates away and navigates back.
   * Everything else — request order, toast wording, undo, failure handling —
   * is identical, which is what makes this worth one hook rather than two
   * copies that drift.
   */
  onRemove: (noteId: number) => () => void;
}

/**
 * Moves a note to the trash, with an undo.
 *
 * The order matters: remove from view FIRST, then call the server. Waiting for
 * the round trip makes a delete feel broken on a slow connection, and the
 * operation is recoverable either way.
 *
 * If the DELETE fails, the note comes back. If the RESTORE fails, it is still
 * in the trash — B4's listing means a missed or failed undo is never data
 * loss, which is what makes the 8-second toast acceptable rather than reckless.
 */
export function useDeleteNote({ onRemove }: DeleteHandlers) {
  const toast = useToast();

  return useCallback(
    async (noteId: number, title: string | null) => {
      const restore = onRemove(noteId);
      const label = title?.trim() ?? '';

      try {
        await noteService.softDeleteNote(noteId);
      } catch {
        restore();
        toast.show({ message: 'Could not move that note to the trash.' });
        return;
      }

      toast.show({
        message: label === '' ? 'Note moved to trash.' : `“${label}” moved to trash.`,
        action: {
          label: 'Undo',
          onAction: () => {
            // Restore the view first: undo should feel as instant as the
            // delete it is reversing.
            restore();
            toast.dismiss();

            void noteService.restoreNote(noteId).catch(() => {
              toast.show({ message: 'Could not restore that note. It is still in your trash.' });
            });
          },
        },
      });
    },
    [onRemove, toast],
  );
}
