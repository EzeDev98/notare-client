/** Converts a note body document to Markdown. */
import type { JSONContent } from '@tiptap/core';
import type * as Y from 'yjs';

import { toJson } from '@/features/editor/bodyText';

const LIST_TYPES = new Set(['bulletList', 'orderedList']);

function escapeInline(text: string): string {
  return text.replace(/([\\`*_[\]])/g, '\\$1');
}

function escapeLineStart(line: string): string {
  return line.replace(/^(\s*)([#>+-])/, '$1\\$2').replace(/^(\s*\d+)\./, '$1\\.');
}

function markdownInline(node: JSONContent): string {
  if (node.type === 'hardBreak') return '  \n';
  if (node.type === 'text') {
    const text = escapeInline(node.text ?? '');
    const href = node.marks?.find((mark) => mark.type === 'link')?.attrs?.['href'] as unknown;
    return typeof href === 'string' ? `[${text}](${href})` : text;
  }
  return (node.content ?? []).map(markdownInline).join('');
}

function markdownList(list: JSONContent, indent: string, out: string[]): void {
  const start = Number(list.attrs?.['start'] ?? 1);

  (list.content ?? []).forEach((item, index) => {
    let marker = '- ';
    if (list.type === 'orderedList') marker = `${start + index}. `;

    let first = true;
    for (const child of item.content ?? []) {
      if (child.type && LIST_TYPES.has(child.type)) {
        markdownList(child, indent + ' '.repeat(marker.length), out);
        continue;
      }
      const text = escapeLineStart(markdownInline(child));
      out.push(first ? `${indent}${marker}${text}` : `${indent}${' '.repeat(marker.length)}${text}`);
      first = false;
    }
  });
}

export function bodyToMarkdown(source: Y.Doc | Uint8Array): string {
  const chunks: string[] = [];

  for (const block of toJson(source).content ?? []) {
    if (block.type && LIST_TYPES.has(block.type)) {
      const lines: string[] = [];
      markdownList(block, '', lines);
      chunks.push(lines.join('\n'));
      continue;
    }
    const text = escapeLineStart(markdownInline(block));
    if (text.trim() !== '') chunks.push(text);
  }

  return chunks.join('\n\n');
}
