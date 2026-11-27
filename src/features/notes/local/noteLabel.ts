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

/**
 * Strips Markdown syntax from a single line of stored content, leaving the
 * plain text a reader actually sees once the editor renders it.
 *
 * Content is stored as Markdown (EditorSurface.tsx / tiptap-markdown), so
 * without this a pasted `# Heading` or `**bold**` leaked its raw `#`/`**`
 * characters straight into the label and preview — the same problem rich
 * text already solved for the note BODY, just not yet for this derived
 * text. Block markers (heading hashes, blockquote `>`, list bullets/
 * numbers, task-list checkboxes) are stripped from the start of the line;
 * a line that is nothing but a horizontal rule becomes blank, same as an
 * empty line, so it never becomes the label by accident; inline emphasis,
 * strikethrough, code spans, images and links are unwrapped to their own
 * visible text.
 */
function stripMarkdownLine(line: string): string {
  let text = line;

  text = text.replace(/^\s{0,3}#{1,6}\s+/, '');
  text = text.replace(/^\s{0,3}>+\s?/, '');
  text = text.replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/, '');

  if (/^\s{0,3}([-*_])\s*(?:\1\s*){2,}$/.test(text)) return '';

  text = text.replace(/(\*\*\*|___)(.+?)\1/g, '$2');
  text = text.replace(/(\*\*|__)(.+?)\1/g, '$2');
  text = text.replace(/(?<!\*)\*(?!\*)([^*\n]+?)\*(?!\*)/g, '$1');
  text = text.replace(/(?<!_)_(?!_)([^_\n]+?)_(?!_)/g, '$1');
  text = text.replace(/~~(.+?)~~/g, '$1');
  text = text.replace(/`([^`]+)`/g, '$1');

  // Images before links — an image's "text" is its alt, and the link
  // pattern below would otherwise also match `![alt](url)` and keep the `!`.
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');

  return text;
}

/**
 * With an AI title (AI tidy, inferred from the whole note), that title is the
 * label and the preview is the note's own text from its first line. Without
 * one, the first non-blank line stands in until the note has a title.
 */
export function deriveNoteLabel(content: string, aiTitle?: string | null): NoteLabel {
  const trimmed = content.trim();
  const title = aiTitle?.trim() ?? '';

  if (title !== '') {
    const remainder = trimmed
      .split('\n')
      .map((line) => stripMarkdownLine(line).trim())
      .filter((line) => line !== '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    return { label: title, remainder };
  }

  if (trimmed === '') {
    return { label: EMPTY_NOTE_LABEL, remainder: '' };
  }

  const lines = trimmed.split('\n').map((line) => stripMarkdownLine(line).trim());
  const labelIndex = lines.findIndex((line) => line !== '');

  // Every line was blank, or became blank once Markdown-only lines
  // (a lone heading marker, a horizontal rule) were stripped down to
  // nothing. Same as no content.
  if (labelIndex === -1) {
    return { label: EMPTY_NOTE_LABEL, remainder: '' };
  }

  const label = lines[labelIndex] ?? '';
  const remainder = lines
    .slice(labelIndex + 1)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { label, remainder };
}
