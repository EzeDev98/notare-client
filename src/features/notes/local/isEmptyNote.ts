/**
 * A note is empty only when its text is blank AND it has no clips (step 8e).
 * A note holding just a voice clip is a real note.
 */
export function isEmptyNote(note: { content: string; clipCount: number }): boolean {
  return note.content.trim() === '' && note.clipCount === 0;
}
