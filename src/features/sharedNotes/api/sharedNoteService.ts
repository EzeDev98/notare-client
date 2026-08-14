import type {
  SharedNoteDetailResponse,
  SharedNoteSummaryResponse,
  UpdateSharedNoteRequest,
} from '@/features/sharedNotes/types';
import { httpClient } from '@/lib/http/client';
import type { PagedResponse } from '@/lib/http/types';

/**
 * The recipient side of sharing: `/shared-notes`. Never `/notes` — see
 * NOTARE-SERVER.md §9's chosen design, "(a) Separate collection": `/notes`
 * answers "is this your note?", `/shared-notes` answers "do you hold a
 * grant, and is it strong enough?" — two different authorization questions,
 * kept as two different collections so answering one can never accidentally
 * answer the other.
 *
 * ONLINE-ONLY, deliberately. Not wired into the sync engine or Dexie:
 * "shared notes and voice notes are outside sync"
 * (NOTARE-CLIENT-ARCHITECTURE.md §1.3) — a WRITE collaborator has no
 * auto-save in the first place (see `UpdateSharedNoteRequest`'s doc
 * comment), so there is no offline draft to reconcile. This is why the
 * feature lives behind TanStack Query rather than beside `noteService` in
 * `features/notes`: see ADR-0009.
 *
 * NOTHING HERE CATCHES, same rule as `noteService`: a 403 means something
 * entirely different (a READ collaborator hit `updateSharedNote`) from a 404
 * (no grant at all — the server will not say which, so the client must not
 * either).
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
   * Notes shared WITH the current user, sorted by when they were shared —
   * there is no sort param to override that; it is the server's fixed
   * order for this endpoint.
   *
   * `totalElements` OVERCOUNTS today: the backend counts grants including
   * trashed notes (NOTARE-SERVER.md §15, tracked there as a known gap, not
   * something to work around client-side). Do not render this as a precise
   * total — NOTARE-CLIENT-ARCHITECTURE.md §2.4 says so explicitly.
   */
  listSharedNotes({ page, size, signal }: ListOptions = {}): Promise
    PagedResponse<SharedNoteSummaryResponse>
  > {
    return httpClient.get<PagedResponse<SharedNoteSummaryResponse>>(SHARED_NOTES, {
      query: { page, size },
      ...(signal ? { signal } : {}),
    });
  },

  /**
   * Requires READ. Cannot 403 — READ is the minimum grant this collection
   * exposes at all, so holding any grant satisfies it. No grant means 404,
   * same as an owner-only note someone else asks for: existence is not
   * confirmed to a caller with no relationship to the resource
   * (NOTARE-SERVER.md §3.2).
   *
   * Returns the OWNER's `NoteResponse` shape — see `SharedNoteDetailResponse`
   * for why `pinned`/`archived` on the result must be ignored, not surfaced.
   */
  getSharedNote(noteId: number, { signal }: Cancellable = {}): Promise<SharedNoteDetailResponse> {
    return httpClient.get<SharedNoteDetailResponse>(`${SHARED_NOTES}/${String(noteId)}`, {
      ...(signal ? { signal } : {}),
    });
  },

  /**
   * Requires WRITE. A READ-only grant answers 403, not 404 — the note is
   * already visible to this caller, so NOTARE-SERVER.md §3.2's rule applies:
   * 403 means "this exists, you can see it, but you may not do that."
   *
   * FULL REPLACEMENT, identical null semantics to the owner's `updateNote`:
   * both fields are sent, and null clears the field. There is no PATCH
   * equivalent for this path — see `UpdateSharedNoteRequest`'s doc comment
   * before reaching for auto-save here.
   */
  updateSharedNote(
    noteId: number,
    body: UpdateSharedNoteRequest,
    { signal }: Cancellable = {},
  ): Promise<SharedNoteDetailResponse> {
    return httpClient.put<SharedNoteDetailResponse>(`${SHARED_NOTES}/${String(noteId)}`, {
      body,
      ...(signal ? { signal } : {}),
    });
  },
};
