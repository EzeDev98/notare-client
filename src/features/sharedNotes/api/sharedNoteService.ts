import type { SharedNoteSummaryResponse } from '@/features/sharedNotes/types';
import { httpClient } from '@/lib/http/client';
import type { PagedResponse } from '@/lib/http/types';

/**
 * The recipient side of sharing: `/shared-notes`. It lists what was shared with
 * you and lets you leave. Reading and editing a shared note go through the same
 * note path as any other note (`ROUTES.note(id)`), with the role deciding what
 * is allowed. Nothing here catches: the caller decides what an error means.
 */

const SHARED_NOTES = '/shared-notes';

interface Cancellable {
  signal?: AbortSignal;
}

interface ListOptions extends Cancellable {
  /** Zero-based, same convention as `noteService.listNotes`. */
  page?: number;
  size?: number;
}

export const sharedNoteService = {
  /**
   * Leave a note shared with you: removes the caller's own grant (B-04).
   * Only the grantee can call it. The owner removes people through `/notes/{id}/shares` instead.
   */
  leaveNote(noteId: number, { signal }: Cancellable = {}): Promise<void> {
    return httpClient.delete<void>(`${SHARED_NOTES}/${String(noteId)}/access`, {
      ...(signal ? { signal } : {}),
    });
  },

  /**
   * Notes shared WITH the current user, newest share first. `totalElements`
   * overcounts today (trashed notes are counted), so never render it as a total.
   */
  listSharedNotes({ page, size, signal }: ListOptions = {}): Promise<
    PagedResponse<SharedNoteSummaryResponse>
  > {
    return httpClient.get<PagedResponse<SharedNoteSummaryResponse>>(SHARED_NOTES, {
      query: { page, size },
      ...(signal ? { signal } : {}),
    });
  },
};
