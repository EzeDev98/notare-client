/**
 * Step 12c (D-13): the note body is never focused by code on open. The one
 * exception is right after the user pressed New note: `newNotePath` asks for it
 * here, and the editor takes the request once when that note opens.
 */
let requestedNoteId: string | null = null;

export function requestBodyFocus(noteId: string): void {
  requestedNoteId = noteId;
}

/** True once, for the note that was asked for. */
export function takeBodyFocus(noteId: string): boolean {
  if (requestedNoteId !== noteId) return false;
  requestedNoteId = null;
  return true;
}
