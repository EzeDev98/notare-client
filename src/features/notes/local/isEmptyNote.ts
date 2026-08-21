import type { NoteView } from './noteMappers';

export function isEmptyNote(note: Pick<NoteView, 'title' | 'content'>): boolean {
  return note.title.trim() === '' && note.content.trim() === '';
}
