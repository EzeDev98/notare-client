import type { NoteView } from './noteMappers';

// 1B/5B: no title field — the note domain has none, so emptiness is
// content-only now.
export function isEmptyNote(note: Pick<NoteView, 'content'>): boolean {
  return note.content.trim() === '';
}
