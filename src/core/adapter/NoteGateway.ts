import type { PagedResponse } from '@/lib/http/types';
import type {
  AutoSaveNoteRequest,
  NoteResponse,
  NoteSummaryResponse,
  UpdateNoteRequest,
} from '@/features/notes/types';
import type { VoiceNoteResponse } from '@/features/voice/types';

/**
 * Everything the app asks the note server to do, in one contract (master 9.6).
 *
 * Screens and hooks call `gateway.x()` and never a service file, so when the
 * server changes (client ids, per-change saves, clips as children of notes) one
 * implementation changes and the screens do not. Today's only implementation is
 * legacyGateway.ts. What it has to fake is listed in docs/adapter.md.
 *
 * Nothing here catches. Errors reach the caller as ApiError, because a 409
 * means different things to the editor and to the sync engine.
 *
 * A "clip" is a voice recording (master 8). The server still calls it a voice
 * note; that name stays inside legacyGateway.
 */

export interface Cancellable {
  signal?: AbortSignal;
}

export interface ListOptions extends Cancellable {
  /** Zero-based. */
  page?: number;
  size?: number;
  /** Spring sort expressions. */
  sort?: string[];
}

export interface PageOptions extends Cancellable {
  /** Zero-based. */
  page?: number;
  size?: number;
}

export interface CreateNoteInput {
  content?: string;
  /**
   * The id this device gave the note. Sent so the server can keep it and echo
   * it back. The server may ignore it today (step 17b checks).
   */
  clientId?: string;
}

export interface UploadClipOptions extends Cancellable {
  /** Attach the clip to this note (server id). */
  noteId?: number;
  durationSeconds?: number;
  /** 0 to 1. */
  onProgress?: (fraction: number) => void;
}

export interface NoteGateway {
  // --- Your notes ----------------------------------------------------------
  listNotes(options?: ListOptions): Promise<PagedResponse<NoteSummaryResponse>>;
  searchNotes(query: string, options?: PageOptions): Promise<PagedResponse<NoteSummaryResponse>>;
  getNote(noteId: number, options?: Cancellable): Promise<NoteResponse>;
  createNote(body: CreateNoteInput, options?: Cancellable): Promise<NoteResponse>;
  /** Full replacement. null clears the field. */
  updateNote(noteId: number, body: UpdateNoteRequest, options?: Cancellable): Promise<NoteResponse>;
  /** Partial save. An omitted field is left alone. */
  autoSaveNote(
    noteId: number,
    patch: AutoSaveNoteRequest,
    options?: Cancellable,
  ): Promise<NoteResponse>;
  /** Deletes for good. Irreversible. */
  deleteNote(noteId: number, options?: Cancellable): Promise<void>;
  setPinned(noteId: number, pinned: boolean, options?: Cancellable): Promise<NoteResponse>;

  // --- Your clips ----------------------------------------------------------
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
