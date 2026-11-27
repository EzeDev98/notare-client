/** Carries server text into a saved note body, keeping its voice clips and links. */
import * as Y from 'yjs';

import { diff } from '@/features/editor/bodyDiff';
import { bodyToPlainText } from '@/features/editor/bodyText';
import { BODY_FIELD } from '@/features/editor/editorExtensions';

const LIST_NODES = new Set(['bulletList', 'orderedList']);

const LIST_LINE = /^(?:[-*] |\d+\. )/;

interface Slot {
  paragraph: Y.XmlElement;
  marker: string;
  block: Y.XmlElement;
  lastOfBlock: boolean;
}

function textNodeOf(paragraph: Y.XmlElement): Y.XmlText | null | undefined {
  const children = paragraph.toArray();
  if (children.length === 0) return null;
  const [only] = children;
  return children.length === 1 && only instanceof Y.XmlText ? only : undefined;
}

function plainOf(text: Y.XmlText | null): string | undefined {
  if (text === null) return '';
  let out = '';
  for (const op of text.toDelta() as { insert: unknown }[]) {
    if (typeof op.insert !== 'string') return undefined;
    out += op.insert;
  }
  return out;
}

function collectSlots(fragment: Y.XmlFragment): Slot[] | null {
  const slots: Slot[] = [];

  const fromList = (list: Y.XmlElement, block: Y.XmlElement): boolean => {
    const start = Number(list.getAttribute('start') ?? 1);
    let index = 0;
    for (const item of list.toArray()) {
      if (!(item instanceof Y.XmlElement) || item.nodeName !== 'listItem') return false;
      const marker = list.nodeName === 'orderedList' ? `${String(start + index)}. ` : '- ';
      let first = true;
      for (const child of item.toArray()) {
        if (!(child instanceof Y.XmlElement)) return false;
        if (LIST_NODES.has(child.nodeName)) {
          if (!fromList(child, block)) return false;
          continue;
        }
        if (child.nodeName !== 'paragraph') return false;
        slots.push({ paragraph: child, marker: first ? marker : '', block, lastOfBlock: false });
        first = false;
      }
      index += 1;
    }
    return true;
  };

  for (const block of fragment.toArray()) {
    if (!(block instanceof Y.XmlElement)) return null;
    if (block.nodeName === 'voiceClip') continue;
    const before = slots.length;
    if (LIST_NODES.has(block.nodeName)) {
      if (!fromList(block, block)) return null;
    } else if (block.nodeName === 'paragraph') {
      slots.push({ paragraph: block, marker: '', block, lastOfBlock: false });
    } else {
      return null;
    }
    const last = slots[slots.length - 1];
    if (slots.length > before && last) last.lastOfBlock = true;
  }
  return slots;
}

function editText(paragraph: Y.XmlElement, node: Y.XmlText | null, from: string, to: string): void {
  if (from === to) return;
  let text = node;
  if (text === null) {
    text = new Y.XmlText();
    paragraph.insert(0, [text]);
  }

  let prefix = 0;
  while (prefix < from.length && prefix < to.length && from[prefix] === to[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < from.length - prefix &&
    suffix < to.length - prefix &&
    from[from.length - 1 - suffix] === to[to.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  const oldMiddle = from.slice(prefix, from.length - suffix).split('');
  const newMiddle = to.slice(prefix, to.length - suffix).split('');

  const changes: { at: number; remove: number; add: string }[] = [];
  const ops = diff(oldMiddle, newMiddle);
  if (ops === null) {
    changes.push({ at: prefix, remove: oldMiddle.length, add: newMiddle.join('') });
  } else {
    let oldAt = 0;
    let current: { at: number; remove: number; add: string } | null = null;
    for (const op of ops) {
      if (op.kind === 'equal') {
        if (current) changes.push(current);
        current = null;
        oldAt += 1;
        continue;
      }
      current ??= { at: prefix + oldAt, remove: 0, add: '' };
      if (op.kind === 'delete') {
        current.remove += 1;
        oldAt += 1;
      } else {
        current.add += newMiddle[op.b] ?? '';
      }
    }
    if (current) changes.push(current);
  }

  for (const change of changes.reverse()) {
    if (change.remove > 0) text.delete(change.at, change.remove);
    if (change.add !== '') text.insert(change.at, change.add);
  }
}

function newParagraph(line: string): Y.XmlElement {
  const paragraph = new Y.XmlElement('paragraph');
  if (line !== '') paragraph.insert(0, [new Y.XmlText(line)]);
  return paragraph;
}

export function rebaseBody(doc: Y.Doc, content: string): boolean {
  const fragment = doc.getXmlFragment(BODY_FIELD);
  const slots = collectSlots(fragment);
  if (slots === null) return false;

  const nodes: (Y.XmlText | null)[] = [];
  const oldLines: string[] = [];
  for (const slot of slots) {
    const node = textNodeOf(slot.paragraph);
    if (node === undefined) return false;
    const plain = plainOf(node);
    if (plain === undefined) return false;
    nodes.push(node);
    oldLines.push(slot.marker + plain);
  }
  if (oldLines.join('\n') !== bodyToPlainText(doc)) return false;

  const newLines = content.split('\n');
  const ops = diff(oldLines, newLines);
  if (ops === null) return false;

  let ok = true;
  doc.transact(() => {
    let index = 0;
    let previous: Slot | null = null;
    while (index < ops.length && ok) {
      const op = ops[index];
      if (op?.kind === 'equal') {
        previous = slots[op.a] ?? null;
        index += 1;
        continue;
      }

      const removed: number[] = [];
      const added: number[] = [];
      while (index < ops.length && ops[index]?.kind !== 'equal') {
        const change = ops[index];
        if (change?.kind === 'delete') removed.push(change.a);
        if (change?.kind === 'insert') added.push(change.b);
        index += 1;
      }

      const paired = Math.min(removed.length, added.length);
      for (let k = 0; k < paired && ok; k += 1) {
        const at = removed[k] ?? -1;
        const slot = slots[at];
        const line = newLines[added[k] ?? -1];
        if (!slot || line === undefined || !line.startsWith(slot.marker)) {
          ok = false;
          break;
        }
        const from = (oldLines[at] ?? '').slice(slot.marker.length);
        editText(slot.paragraph, nodes[at] ?? null, from, line.slice(slot.marker.length));
        previous = slot;
      }

      for (const at of removed.slice(paired)) {
        const slot = slots[at];
        if (!slot || slot.paragraph !== slot.block) {
          ok = false;
          break;
        }
        const position = fragment.toArray().indexOf(slot.block);
        if (position === -1) {
          ok = false;
          break;
        }
        fragment.delete(position, 1);
      }

      let insertAt: number;
      if (previous === null) {
        insertAt = 0;
      } else if (previous.lastOfBlock) {
        insertAt = fragment.toArray().indexOf(previous.block) + 1;
      } else {
        insertAt = -1;
      }
      for (const at of added.slice(paired)) {
        const line = newLines[at] ?? '';
        if (insertAt <= -1 || LIST_LINE.test(line)) {
          ok = false;
          break;
        }
        fragment.insert(insertAt, [newParagraph(line)]);
        insertAt += 1;
      }
    }
  });

  return ok && bodyToPlainText(doc) === content;
}
