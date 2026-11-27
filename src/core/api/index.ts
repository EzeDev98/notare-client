/** Note-server calls made online rather than through sync. */
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
