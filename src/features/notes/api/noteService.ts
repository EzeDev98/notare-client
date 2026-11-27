/** Server calls for notes. */
import type {
  AutoSaveNoteRequest,
  CreateNoteRequest,
  NoteResponse,
  NoteSummaryResponse,
  UpdateNoteRequest,
} from '@/features/notes/types';
import { httpClient } from '@/lib/http/client';
import type { PagedResponse } from '@/lib/http/types';

const NOTES = '/notes';

interface Cancellable {
  signal?: AbortSignal;
}

interface ListOptions extends Cancellable {
  page?: number;
  size?: number;
  sort?: string[];
}

interface SearchOptions extends Cancellable {
  page?: number;
  size?: number;
}

export const noteService = {
  listNotes({ page, size, sort, signal }: ListOptions = {}): Promise<
    PagedResponse<NoteSummaryResponse>
  > {
    return httpClient.get<PagedResponse<NoteSummaryResponse>>(NOTES, {
      query: { page, size, sort },
      ...(signal ? { signal } : {}),
    });
  },

  searchNotes(
    query: string,
    { page, size, signal }: SearchOptions = {},
  ): Promise<PagedResponse<NoteSummaryResponse>> {
    return httpClient.get<PagedResponse<NoteSummaryResponse>>(`${NOTES}/search`, {
      query: { query, page, size },
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

  deleteNote(noteId: number, { signal }: Cancellable = {}): Promise<void> {
    return httpClient.delete<void>(`${NOTES}/${String(noteId)}`, {
      ...(signal ? { signal } : {}),
    });
  },

  setPinned(noteId: number, pinned: boolean, { signal }: Cancellable = {}): Promise<NoteResponse> {
    const path = `${NOTES}/${String(noteId)}/pin`;
    const config = { ...(signal ? { signal } : {}) };
    return pinned
      ? httpClient.post<NoteResponse>(path, config)
      : httpClient.delete<NoteResponse>(path, config);
  },

  restoreOriginal(noteId: number, { signal }: Cancellable = {}): Promise<NoteResponse> {
    return httpClient.post<NoteResponse>(`${NOTES}/${String(noteId)}/restore-original`, {
      ...(signal ? { signal } : {}),
    });
  },
};
