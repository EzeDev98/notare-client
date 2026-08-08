import type {
  AutoSaveNoteRequest,
  CreateNoteRequest,
  NoteResponse,
  NoteSummaryResponse,
  TrashedNoteResponse,
  UpdateNoteRequest,
} from '@/features/notes/types';
import { httpClient } from '@/lib/http/client';
import type { PagedResponse } from '@/lib/http/types';

/**
 * The only place that knows the note API's paths, parameter names and verbs.
 *
 * Three of those are easy to get wrong quietly, which is most of why this
 * layer exists:
 *
 *   - search takes `query`, NOT `q`. The server doc says q; the controller
 *     says query. It is also REQUIRED, so omitting it is a 400 rather than an
 *     empty result.
 *   - `page` is ZERO-BASED (Spring's Pageable). A UI showing "Page 1" adds one.
 *   - PUT and PATCH have OPPOSITE null semantics. See the two methods below.
 *
 * NOTHING HERE CATCHES. Errors propagate as ApiError and the caller decides,
 * because a 409 means entirely different things to the editor (show the
 * conflict UI) and to the sync engine (quarantine the operation). A service
 * that catches has to guess which caller it has.
 */

const NOTES = '/notes';

/** Shared by every method: cancellation reaching fetch is what makes it work. */
interface Cancellable {
  signal?: AbortSignal;
}

interface ListOptions extends Cancellable {
  /** Zero-based. */
  page?: number;
  size?: number;
  /**
   * false (the default) excludes archived notes; true returns ONLY archived.
   * There is no "both" — B5 made these two screens deliberately.
   */
  archived?: boolean;
  /** Spring sort expressions. Defaults server-side to pinned,updatedAt DESC. */
  sort?: string[];
}

interface SearchOptions extends Cancellable {
  page?: number;
  size?: number;
}

export const noteService = {
  /** The owner's notes. Archived excluded unless asked for. */
  listNotes({ page, size, archived, sort, signal }: ListOptions = {}): Promise
    PagedResponse<NoteSummaryResponse>
  > {
    return httpClient.get<PagedResponse<NoteSummaryResponse>>(NOTES, {
      query: { page, size, archived, sort },
      ...(signal ? { signal } : {}),
    });
  },

  /**
   * Keyword search over title and content.
   *
   * The parameter is `query`. It is required — a blank string means "match
   * everything" for notes, but the parameter itself must be present.
   *
   * Wildcards in the term are literal: B8 escapes % and _ server-side, and 3C
   * percent-encodes them for transport. A search for "100%" finds notes
   * containing a percent sign rather than every note the user owns.
   */
  searchNotes(query: string, { page, size, signal }: SearchOptions = {}): Promise
    PagedResponse<NoteSummaryResponse>
  > {
    return httpClient.get<PagedResponse<NoteSummaryResponse>>(`${NOTES}/search`, {
      query: { query, page, size },
      ...(signal ? { signal } : {}),
    });
  },

  /**
   * Soft-deleted notes (B4).
   *
   * `deletedAt` supports "trashed 3 days ago" and NOT a countdown — nothing on
   * the server purges trashed notes.
   */
  listTrash({ page, size, signal }: SearchOptions = {}): Promise
    PagedResponse<TrashedNoteResponse>
  > {
    return httpClient.get<PagedResponse<TrashedNoteResponse>>(`${NOTES}/trash`, {
      query: { page, size },
      ...(signal ? { signal } : {}),
    });
  },

  getNote(noteId: number, { signal }: Cancellable = {}): Promise<NoteResponse> {
    return httpClient.get<NoteResponse>(`${NOTES}/${String(noteId)}`, {
      ...(signal ? { signal } : {}),
    });
  },

  createNote(body: CreateNoteRequest, { signal }: Cancellable = {}): Promise<NoteResponse> {
    return httpClient.post<NoteResponse>(NOTES, { body, ...(signal ? { signal } : {}) });
  },

  /**
   * FULL REPLACEMENT. Both fields are sent and null CLEARS.
   *
   * The dangerous one. Sending { title: 'x', content: null } erases the body.
   * The type makes that explicit rather than accidental: both fields are
   * required, so you cannot omit content and hope.
   */
  updateNote(
    noteId: number,
    body: UpdateNoteRequest,
    { signal }: Cancellable = {},
  ): Promise<NoteResponse> {
    return httpClient.put<NoteResponse>(`${NOTES}/${String(noteId)}`, {
      body,
      ...(signal ? { signal } : {}),
    });
  },

  /**
   * PARTIAL UPDATE — auto-save. An omitted field means "leave it alone".
   *
   * To CLEAR a field, send an empty string. Never null: that is PUT's verb.
   *
   * Two properties Step 6 depends on:
   *
   * IDEMPOTENT. If the values equal what is stored, Hibernate's dirty checking
   * issues no UPDATE, so version does not move and a retried save is free.
   *
   * THE RETURNED VERSION MUST BE ADOPTED, never incremented locally. B5 made
   * this sharper: pinning a note from the list bumps the version, so an open
   * editor holding a stale one conflicts on its next save unless every note
   * response flows back into the store.
   */
  autoSaveNote(
    noteId: number,
    patch: AutoSaveNoteRequest,
    { signal }: Cancellable = {},
  ): Promise<NoteResponse> {
    return httpClient.patch<NoteResponse>(`${NOTES}/${String(noteId)}`, {
      body: patch,
      ...(signal ? { signal } : {}),
    });
  },

  /** To the trash. Recoverable; grants survive so a restore brings them back. */
  softDeleteNote(noteId: number, { signal }: Cancellable = {}): Promise<void> {
    return httpClient.delete<void>(`${NOTES}/${String(noteId)}`, {
      ...(signal ? { signal } : {}),
    });
  },

  restoreNote(noteId: number, { signal }: Cancellable = {}): Promise<NoteResponse> {
    return httpClient.post<NoteResponse>(`${NOTES}/${String(noteId)}/restore`, {
      ...(signal ? { signal } : {}),
    });
  },

  /**
   * Irreversible. 204, no body — which is why parseResponse handles an empty
   * body rather than calling .json() and choking on nothing (3B).
   */
  permanentlyDeleteNote(noteId: number, { signal }: Cancellable = {}): Promise<void> {
    return httpClient.delete<void>(`${NOTES}/${String(noteId)}/permanent`, {
      ...(signal ? { signal } : {}),
    });
  },

  /*
   * Pin and archive: POST to set, DELETE to clear (B5).
   *
   * Action sub-paths rather than fields on PATCH, because PATCH is auto-save —
   * an organisation flag in that body would let a stale editor silently un-pin
   * a note on its next keystroke save.
   *
   * All four return the full note so the caller can adopt the new version.
   * Owner-only: there is deliberately no shared-notes counterpart.
   *
   * NOT AVAILABLE OFFLINE. The sync protocol carries title, content and
   * version only, so a pin made offline cannot be queued. Step 8 disables
   * these rather than applying them locally and losing them on the next pull.
   */
  setPinned(noteId: number, pinned: boolean, { signal }: Cancellable = {}): Promise<NoteResponse> {
    const path = `${NOTES}/${String(noteId)}/pin`;
    const config = { ...(signal ? { signal } : {}) };
    return pinned
      ? httpClient.post<NoteResponse>(path, config)
      : httpClient.delete<NoteResponse>(path, config);
  },

  setArchived(
    noteId: number,
    archived: boolean,
    { signal }: Cancellable = {},
  ): Promise<NoteResponse> {
    const path = `${NOTES}/${String(noteId)}/archive`;
    const config = { ...(signal ? { signal } : {}) };
    return archived
      ? httpClient.post<NoteResponse>(path, config)
      : httpClient.delete<NoteResponse>(path, config);
  },
};
