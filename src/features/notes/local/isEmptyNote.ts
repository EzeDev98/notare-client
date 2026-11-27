/** Whether a note has no text and no clips. */
export function isEmptyNote(note: { content: string; clipCount: number }): boolean {
  return note.content.trim() === '' && note.clipCount === 0;
}
