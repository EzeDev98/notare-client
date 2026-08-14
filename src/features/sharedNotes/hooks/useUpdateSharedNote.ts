import { useQueryClient, useMutation } from '@tanstack/react-query';

import { sharedNoteService } from '@/features/sharedNotes/api/sharedNoteService';
import { sharedNotesKeys } from '@/features/sharedNotes/hooks/useSharedNotes';
import type {
  SharedNoteSummaryResponse,
  UpdateSharedNoteRequest,
} from '@/features/sharedNotes/types';
import type { PagedResponse } from '@/lib/http/types';

/**
 * Saves a WRITE collaborator's edit. PUT, full replacement — there is no
 * auto-save equivalent (see `UpdateSharedNoteRequest`'s doc comment), so the
 * caller decides when this fires: on blur, or an explicit save action. It is
 * not wired to a keystroke handler here or anywhere else.
 *
 * On success, writes the server's response straight into BOTH this note's
 * detail cache and its row in the list cache, rather than invalidating and
 * refetching either. The response already carries the adopted version and
 * the saved title/content — a refetch would ask the server to confirm
 * something it just told us, for the cost of a round trip the version
 * conflict check exists specifically to avoid needing.
 */
export function useUpdateSharedNote(noteId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: UpdateSharedNoteRequest) => sharedNoteService.updateSharedNote(noteId, body),
    onSuccess: (updated) => {
      queryClient.setQueryData(sharedNotesKeys.detail(noteId), updated);

      queryClient.setQueriesData<PagedResponse<SharedNoteSummaryResponse>>(
        { queryKey: sharedNotesKeys.lists() },
        (page) => {
          if (!page) return page;
          return {
            ...page,
            content: page.content.map((row) =>
              row.note.id === noteId
                ? { ...row, note: { ...row.note, title: updated.title, version: updated.version } }
                : row,
            ),
          };
        },
      );
    },
  });
}
