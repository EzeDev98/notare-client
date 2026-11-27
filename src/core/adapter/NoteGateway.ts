/** Everything the app asks of the note server, as one interface. */
import type { PagedResponse } from '@/lib/http/types';
import type {
  AutoSaveNoteRequest,
  NoteResponse,
  NoteSummaryResponse,
  UpdateNoteRequest,
} from '@/features/notes/types';
import type { VoiceNoteResponse } from '@/features/voice/types';

export interface Cancellable {
  signal?: AbortSignal;
}

export interface ListOptions extends Cancellable {
  page?: number;
  size?: number;
  sort?: string[];
}

export interface PageOptions extends Cancellable {
  page?: number;
  size?: number;
}

export interface CreateNoteInput {
  content?: string;
  clientId?: string;
}

export interface UploadClipOptions extends Cancellable {
  noteId?: number;
  durationSeconds?: number;
  onProgress?: (fraction: number) => void;
}

export interface NoteGateway {
  listNotes(options?: ListOptions): Promise<PagedResponse<NoteSummaryResponse>>;
  searchNotes(query: string, options?: PageOptions): Promise<PagedResponse<NoteSummaryResponse>>;
  getNote(noteId: number, options?: Cancellable): Promise<NoteResponse>;
  createNote(body: CreateNoteInput, options?: Cancellable): Promise<NoteResponse>;
  updateNote(noteId: number, body: UpdateNoteRequest, options?: Cancellable): Promise<NoteResponse>;
  autoSaveNote(
    noteId: number,
    patch: AutoSaveNoteRequest,
    options?: Cancellable,
  ): Promise<NoteResponse>;
  deleteNote(noteId: number, options?: Cancellable): Promise<void>;
  setPinned(noteId: number, pinned: boolean, options?: Cancellable): Promise<NoteResponse>;

  uploadClip(file: Blob, options?: UploadClipOptions): Promise<VoiceNoteResponse>;
  getClip(clipId: number, options?: Cancellable): Promise<VoiceNoteResponse>;
  listClips(
    page: number,
    size: number,
    options?: Cancellable,
  ): Promise<PagedResponse<VoiceNoteResponse>>;
  listClipsByNote(noteId: number, options?: Cancellable): Promise<VoiceNoteResponse[]>;
  downloadClip(clipId: number, options?: Cancellable): Promise<Blob>;
  deleteClip(clipId: number, options?: Cancellable): Promise<void>;
}
