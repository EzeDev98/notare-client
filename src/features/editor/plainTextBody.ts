/** Converts between plain text and editor blocks. */
import type { JSONContent } from '@tiptap/core';

type ListKind = 'bullet' | 'ordered';

const BULLET_LINE = /^[-*] (.*)$/;
const ORDERED_LINE = /^\d+\. (.*)$/;

const LIST_NODE = { bullet: 'bulletList', ordered: 'orderedList' } as const;
const ITEM_NODE = { bullet: 'listItem', ordered: 'listItem' } as const;
const LIST_TYPES = new Set<string>(Object.values(LIST_NODE));

interface ParsedLine {
  kind: ListKind | null;
  text: string;
}

function parseLine(line: string): ParsedLine {
  const bullet = BULLET_LINE.exec(line);
  if (bullet) return { kind: 'bullet', text: bullet[1] ?? '' };
  const ordered = ORDERED_LINE.exec(line);
  if (ordered) return { kind: 'ordered', text: ordered[1] ?? '' };
  return { kind: null, text: line };
}

function paragraph(text: string): JSONContent {
  return text === ''
    ? { type: 'paragraph' }
    : { type: 'paragraph', content: [{ type: 'text', text }] };
}

export function textToDoc(text: string): JSONContent {
  const blocks: JSONContent[] = [];
  let current = null as { kind: ListKind; node: JSONContent } | null;

  for (const line of text.split('\n')) {
    const parsed = parseLine(line);

    if (parsed.kind === null) {
      current = null;
      blocks.push(paragraph(line));
      continue;
    }

    if (current?.kind !== parsed.kind) {
      current = { kind: parsed.kind, node: { type: LIST_NODE[parsed.kind], content: [] } };
      blocks.push(current.node);
    }

    current.node.content?.push({
      type: ITEM_NODE[parsed.kind],
      content: [paragraph(parsed.text)],
    });
  }

  return { type: 'doc', content: blocks };
}

function inlineText(node: JSONContent): string {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return '\n';
  return (node.content ?? []).map(inlineText).join('');
}

function listLines(list: JSONContent, out: string[]): void {
  const start = Number(list.attrs?.['start'] ?? 1);

  (list.content ?? []).forEach((item, index) => {
    let marker = '- ';
    if (list.type === 'orderedList') marker = `${start + index}. `;

    let first = true;
    for (const child of item.content ?? []) {
      if (child.type && LIST_TYPES.has(child.type)) {
        listLines(child, out);
        continue;
      }
      out.push((first ? marker : '') + inlineText(child));
      first = false;
    }
  });
}

export function docToText(doc: JSONContent): string {
  const lines: string[] = [];
  for (const block of doc.content ?? []) {
    if (block.type === 'voiceClip') continue;
    if (block.type && LIST_TYPES.has(block.type)) listLines(block, lines);
    else lines.push(inlineText(block));
  }
  return lines.join('\n');
}
