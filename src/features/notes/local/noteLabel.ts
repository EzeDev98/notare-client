/**
 * 1C: what a note is called, now that there is no title field.
 *
 * The reference app's own convention (previously SidebarNoteItem's fallback
 * for a note with no explicit title, now the ONLY source of a label since
 * 1B discarded the title field itself): the first non-blank line of content
 * IS the label. Everything after that line is the "remainder" — what a
 * one-line preview beside the label should show, so the label and its own
 * preview never just repeat each other.
 *
 * A note with no content at all (brand new, or every line blank) has no
 * first line to borrow, so it reads as "New Note" / "No additional text" —
 * never "Untitled". Nothing has been left blank so much as not yet written.
 *
 * ONE implementation, not one per display surface (sidebar, card, search,
 * conflict panel, ...) — the trim/split/find-first-non-blank-line logic is
 * subtle enough (leading blank lines, whitespace-only lines) that six
 * hand-rolled copies would drift from each other silently.
 */

export const EMPTY_NOTE_LABEL = 'New Note';
export const EMPTY_NOTE_REMAINDER = 'No additional text';

export interface NoteLabel {
  /** The first non-blank line, trimmed. `EMPTY_NOTE_LABEL` when there is none. */
  label: string;
  /**
   * Whatever content follows the label line, collapsed to a single line
   * (internal whitespace/newlines flattened to single spaces) and trimmed.
   * '' when there is nothing after the label line — callers that need a
   * placeholder for that case should use `EMPTY_NOTE_REMAINDER` themselves,
   * the same way they already choose their own preview truncation length.
   */
  remainder: string;
}

export function deriveNoteLabel(content: string): NoteLabel {
  const trimmed = content.trim();

  if (trimmed === '') {
    return { label: EMPTY_NOTE_LABEL, remainder: '' };
  }

  const lines = trimmed.split('\n');
  const labelIndex = lines.findIndex((line) => line.trim() !== '');

  // Every line is blank (whitespace-only) even though `trimmed` itself
  // wasn't — e.g. content that is just "\n   \n". Same as no content.
  if (labelIndex === -1) {
    return { label: EMPTY_NOTE_LABEL, remainder: '' };
  }

  const label = (lines[labelIndex] ?? '').trim();
  const remainder = lines
    .slice(labelIndex + 1)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { label, remainder };
}
