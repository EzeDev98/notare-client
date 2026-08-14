import { useQueryClient } from '@tanstack/react-query';

import { sharedNotesKeys } from '@/features/sharedNotes/hooks/useSharedNotes';
import type { PagedResponse } from '@/lib/http/types';
import type { SharedNoteSummaryResponse, SharePermission } from '@/features/sharedNotes/types';

/**
 * A best-effort READ/WRITE hint for a shared note, read from whatever
 * "Shared with me" list pages are already sitting in the React Query cache.
 *
 * WHY THIS HAS TO EXIST AT ALL: `GET /shared-notes/{noteId}` — the query
 * `/shared/:id` actually loads — returns the owner's bare `NoteResponse`
 * with no permission field on it whatsoever (NOTARE-SERVER.md's own
 * hardening backlog, `SharedNoteDetailResponse` row: a documented, known
 * gap, not something missed here). Only `GET /shared-notes` (the LIST) ever
 * says which grant this is. So a direct visit to `/shared/:id` — a
 * bookmark, a refresh, a pasted link — has NO reliable source for this at
 * all until the server closes that gap.
 *
 * `undefined` return means genuinely unknown, not "assume READ" — the
 * caller decides what unknown should default to, because that decision
 * belongs with the UI risk it trades off (see `SharedNote.tsx`), not
 * buried in a data-layer hook.
 */
export function useSharedNotePermission(noteId: number): SharePermission | undefined {
  const queryClient = useQueryClient();

  const cachedLists = queryClient.getQueriesData<PagedResponse<SharedNoteSummaryResponse>>({
    queryKey: sharedNotesKeys.lists(),
  });

  for (const [, page] of cachedLists) {
    const match = page?.content.find((row) => row.note.id === noteId);
    if (match) return match.permission;
  }

  return undefined;
}
