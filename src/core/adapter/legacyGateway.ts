import { noteService } from '@/features/notes/api/noteService';
import { voiceService } from '@/features/voice/api/voiceService';

import type { NoteGateway } from './NoteGateway';

/**
 * The gateway for the server as it is today. Each method forwards to the
 * existing service, whose HTTP code is unchanged. What it fakes or papers over
 * is listed in docs/adapter.md; step 20 deletes this file and that list.
 *
 * The two service modules may only be imported here (ESLint enforces it).
 */
export const legacyGateway: NoteGateway = {
  listNotes: (options) => noteService.listNotes(options),
  searchNotes: (query, options) => noteService.searchNotes(query, options),
  getNote: (noteId, options) => noteService.getNote(noteId, options),
  createNote: (body, options) => noteService.createNote(body, options),
  updateNote: (noteId, body, options) => noteService.updateNote(noteId, body, options),
  autoSaveNote: (noteId, patch, options) => noteService.autoSaveNote(noteId, patch, options),
  deleteNote: (noteId, options) => noteService.deleteNote(noteId, options),
  setPinned: (noteId, pinned, options) => noteService.setPinned(noteId, pinned, options),

  uploadClip: (file, options) => voiceService.uploadVoiceNote(file, options),
  getClip: (clipId, options) => voiceService.getVoiceNote(clipId, options),
  listClips: (page, size, options) => voiceService.listVoiceNotes(page, size, options),
  listClipsByNote: (noteId, options) => voiceService.listVoiceNotesByNote(noteId, options),
  downloadClip: (clipId, options) => voiceService.downloadVoiceNoteBlob(clipId, options),
  deleteClip: (clipId, options) => voiceService.deleteVoiceNote(clipId, options),
};
