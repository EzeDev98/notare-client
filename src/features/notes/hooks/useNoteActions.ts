import { useCallback } from 'react';

import { useToast } from '@/app/providers/toast-context';
import { noteService } from '@/features/notes/api/noteService';
import type { NoteSummaryResponse } from '@/features/notes/types';

interface NoteActionHandlers {
  /**
   * Applies a partial update to whatever holds this note.
   *
   * A PATCH shape rather than a whole note, because the caller holds
   * NoteSummaryResponse (no content) while the server returns NoteResponse
   * (with it). Passing the full note would force a lossy cast at every call
   * site; passing the fields that changed does not.
   *
   * REQUIRED, not optional — this is the B5 obligation. Pin and archive bump
   * @Version, so a list still showing version 3 after a pin returned version 4
   * will send 3 on the next edit and get a 409 for an edit that conflicts with
   * nothing.
   */
  onUpdated: (noteId: number, changes: Partial<NoteSummaryResponse>) => void;
  /** Removes the note from view, returning how to put it back. */
  onRemoved: (noteId: number) => () => void;
}

/**
 * Pin and archive.
 *
 * Optimism is asymmetric here, on purpose:
 *
 *   PIN keeps the note in the list, so the toggle flips immediately and the
 *   server response only corrects the version. Waiting for a round trip to
 *   show a checkbox change feels broken.
 *
 *   ARCHIVE removes it from the list, so it uses the same
 *   remove-then-confirm-then-offer-undo shape as delete — the note has left,
 *   and the user needs a way back.
 */
export function useNoteActions({ onUpdated, onRemoved }: NoteActionHandlers) {
  const toast = useToast();

  const setPinned = useCallback(
    async (note: NoteSummaryResponse) => {
      const next = !note.pinned;

      // Optimistic flip. A pinned note does NOT jump to the top — re-sorting
      // under the cursor means the thing you just clicked leaps away. The
      // order is right on the next load.
      onUpdated(note.id, { pinned: next });

      try {
        const updated = await noteService.setPinned(note.id, next);
        // Adopt the server's version. This is the line that stops the next
        // edit 409ing.
        onUpdated(note.id, {
          pinned: updated.pinned,
          version: updated.version,
          updatedAt: updated.updatedAt,
        });
      } catch {
        onUpdated(note.id, { pinned: note.pinned });
        toast.show({ message: next ? 'Could not pin that note.' : 'Could not unpin that note.' });
      }
    },
    [onUpdated, toast],
  );

  const archive = useCallback(
    async (note: NoteSummaryResponse) => {
      const restore = onRemoved(note.id);

      try {
        await noteService.setArchived(note.id, true);
      } catch {
        restore();
        toast.show({ message: 'Could not archive that note.' });
        return;
      }

      toast.show({
        message: 'Note archived.',
        action: {
          label: 'Undo',
          onAction: () => {
            restore();
            toast.dismiss();
            void noteService.setArchived(note.id, false).catch(() => {
              toast.show({ message: 'Could not unarchive that note.' });
            });
          },
        },
      });
    },
    [onRemoved, toast],
  );

  const unarchive = useCallback(
    async (note: NoteSummaryResponse) => {
      const restore = onRemoved(note.id);

      try {
        await noteService.setArchived(note.id, false);
      } catch {
        restore();
        toast.show({ message: 'Could not unarchive that note.' });
        return;
      }
      toast.show({ message: 'Note moved back to your notes.' });
    },
    [onRemoved, toast],
  );

  return { setPinned, archive, unarchive };
}
