/** What a note is called in the list: its AI title or its text. */
export const EMPTY_NOTE_LABEL = 'New Note';
export const EMPTY_NOTE_REMAINDER = 'No additional text';

export interface NoteLabel {
  label: string;
  remainder: string;
}

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

  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');

  return text;
}

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
