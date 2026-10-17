import { noteService } from '@/features/notes/api/noteService';
import { sharedNoteService } from '@/features/sharedNotes/api/sharedNoteService';
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
 * Pin and archive are online-only by decision (ADR-0006); the server's sync batch has no operation for them.
 * The three service modules may only be imported here (ESLint enforces it).
 */
export const api = {
  getNote: (noteId: number, options?: Cancellable) => noteService.getNote(noteId, options),
  listTrash: (options?: PageOptions) => noteService.listTrash(options),
  deleteNote: (noteId: number, options?: Cancellable) => noteService.softDeleteNote(noteId, options),
  restoreNote: (noteId: number, options?: Cancellable) => noteService.restoreNote(noteId, options),
  purgeNote: (noteId: number, options?: Cancellable) => noteService.permanentlyDeleteNote(noteId, options),
  setPinned: (noteId: number, pinned: boolean, options?: Cancellable) =>
    noteService.setPinned(noteId, pinned, options),
  setArchived: (noteId: number, archived: boolean, options?: Cancellable) =>
    noteService.setArchived(noteId, archived, options),

  uploadClip: (file: Blob, options?: UploadClipOptions) => voiceService.uploadVoiceNote(file, options),
  downloadClip: (clipId: number, options?: Cancellable) => voiceService.downloadVoiceNoteBlob(clipId, options),

  listSharedNotes: (options?: PageOptions) => sharedNoteService.listSharedNotes(options),
  leaveNote: (noteId: number, options?: Cancellable) => sharedNoteService.leaveNote(noteId, options),
};
