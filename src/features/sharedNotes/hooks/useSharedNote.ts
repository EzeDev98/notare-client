import { useQuery } from '@tanstack/react-query';

import { sharedNoteService } from '@/features/sharedNotes/api/sharedNoteService';
import { sharedNotesKeys } from '@/features/sharedNotes/hooks/useSharedNotes';
import { isNotFound } from '@/lib/http/errors';

/**
 * A single shared note — the editor's read model at `/shared/:id`.
 *
 * `retry: false` overrides nothing (the QueryProvider default is already
 * `false`), stated explicitly here because a 404 on this query means "no
 * grant" — NOTARE-SERVER.md §3.2 — and retrying that is never going to
 * change the answer, only delay the permission-denied state the caller
 * needs to show.
 */
export function useSharedNote(noteId: number) {
  return useQuery({
    queryKey: sharedNotesKeys.detail(noteId),
    queryFn: ({ signal }) => sharedNoteService.getSharedNote(noteId, { signal }),
    retry: false,
  });
}

/**
 * True when the query's error is specifically "no grant at all" — the case
 * NOTARE-CLIENT-ARCHITECTURE.md §2.4 says must not be phrased as "this note
 * was deleted", since the same 404 also covers a note that never existed or
 * was never shared with this user in the first place.
 */
export function isNoGrantError(error: unknown): boolean {
  return isNotFound(error);
}
