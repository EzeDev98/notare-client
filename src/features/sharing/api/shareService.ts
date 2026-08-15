import type {
  CreateShareRequest,
  NoteShareResponse,
  UpdateShareRequest,
} from '@/features/sharing/types';
import { httpClient } from '@/lib/http/client';
import type { PagedResponse } from '@/lib/http/types';

/**
 * The owner side's HTTP surface for a note's grants:
 * `/notes/{noteId}/shares[/{userId}]` (NOTARE-SERVER.md §13). Never
 * `/shared-notes` — that collection answers a different authorization
 * question (`sharedNoteService.ts`'s own doc comment) and is the recipient's
 * view of the same underlying rows, not the owner's.
 *
 * Every method here is scoped to a note the CALLER owns. `NoteShareService`
 * asks "is this your note?" (NOTARE-SERVER.md §9) — a 404 on any of these
 * therefore means "not your note, or no such note", conflated on purpose,
 * same pattern as `noteService` and `sharedNoteService` already establish
 * for this codebase.
 */

function shares(noteId: number): string {
  return `/notes/${String(noteId)}/shares`;
}

interface Cancellable {
  signal?: AbortSignal;
}

export const shareService = {
  /** All grants on one note. No pagination controls exposed here — a
   * note's collaborator count is small enough that the server's default
   * page size is never a real constraint in practice, and adding paging UI
   * for a list that never fills a page would be speculative. */
  listShares(noteId: number, { signal }: Cancellable = {}): Promise<PagedResponse<NoteShareResponse>> {
    return httpClient.get<PagedResponse<NoteShareResponse>>(shares(noteId), {
      ...(signal ? { signal } : {}),
    });
  },

  /**
   * 201 + `Location` per the endpoint table — the `Location` header is
   * unreadable from JS on this API regardless (NOTARE-CLIENT-ARCHITECTURE.md
   * §1, CORS `exposedHeaders` omits it), so this reads the created grant
   * from the response BODY, same as every other 201 in this codebase.
   */
  createShare(
    noteId: number,
    body: CreateShareRequest,
    { signal }: Cancellable = {},
  ): Promise<NoteShareResponse> {
    return httpClient.post<NoteShareResponse>(shares(noteId), {
      body,
      ...(signal ? { signal } : {}),
    });
  },

  /** Permission change. `permission` is the only mutable field on a grant
   * (NoteShare's own doc comment), so this is the only PUT this service has. */
  updateShare(
    noteId: number,
    userId: number,
    body: UpdateShareRequest,
    { signal }: Cancellable = {},
  ): Promise<NoteShareResponse> {
    return httpClient.put<NoteShareResponse>(`${shares(noteId)}/${String(userId)}`, {
      body,
      ...(signal ? { signal } : {}),
    });
  },

  /**
   * Revoke. This is the ONLY revocation path for a grant — contrast
   * `collaborationService.cancelCollaboration`, which is the analogous
   * "only path" for a collaboration. The two are independent rows and
   * this does not touch the collaboration at all.
   */
  revokeShare(noteId: number, userId: number, { signal }: Cancellable = {}): Promise<void> {
    return httpClient.delete<void>(`${shares(noteId)}/${String(userId)}`, {
      ...(signal ? { signal } : {}),
    });
  },
};
