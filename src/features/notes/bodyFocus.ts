/** Focuses a new note's body once it opens. */
let requestedNoteId: string | null = null;

export function requestBodyFocus(noteId: string): void {
  requestedNoteId = noteId;
}

export function takeBodyFocus(noteId: string): boolean {
  if (requestedNoteId !== noteId) return false;
  requestedNoteId = null;
  return true;
}
