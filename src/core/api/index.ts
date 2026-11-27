import { noteService } from '@/features/notes/api/noteService';
import { voiceService } from '@/features/voice/api/voiceService';

export interface Cancellable {
  signal?: AbortSignal;
}

export interface PageOptions extends Cancellable {
  page?: number;
  size?: number;
}

export interface UploadClipOptions extends Cancellable {
  noteId?: number;
  durationSeconds?: number;
  onProgress?: (fraction: number) => void;
}

/**
 * The note-server calls the app still makes online (step 20a). Everything else goes through sync.
 * Pin is online-only by decision (ADR-0006); the server's sync batch has no operation for them.
 * Restore original is online-only too: the text it brings back is kept on the server.
 * The two service modules may only be imported here (ESLint enforces it).
 */
export const api = {
  getNote: (noteId: number, options?: Cancellable) => noteService.getNote(noteId, options),
  deleteNote: (noteId: number, options?: Cancellable) => noteService.deleteNote(noteId, options),
  setPinned: (noteId: number, pinned: boolean, options?: Cancellable) =>
    noteService.setPinned(noteId, pinned, options),
  restoreOriginal: (noteId: number, options?: Cancellable) =>
    noteService.restoreOriginal(noteId, options),

  uploadClip: (file: Blob, options?: UploadClipOptions) => voiceService.uploadVoiceNote(file, options),
  downloadClip: (clipId: number, options?: Cancellable) => voiceService.downloadVoiceNoteBlob(clipId, options),
  deleteClip: (clipId: number, options?: Cancellable) => voiceService.deleteVoiceNote(clipId, options),
};
