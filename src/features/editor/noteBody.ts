import { getSchema, type JSONContent } from '@tiptap/core';
import { prosemirrorJSONToYXmlFragment, yXmlFragmentToProsemirrorJSON } from '@tiptap/y-tiptap';
import * as Y from 'yjs';

import { BODY_FIELD, editorExtensions } from '@/features/editor/editorExtensions';
import { docToText, textToDoc } from '@/features/editor/plainTextBody';

/**
 * Step 12b (M-8, D-08): the note body is a Y.Doc with ONE XML fragment.
 *
 * It is saved as `bodyState` (an encoded Yjs update) on the notes row. `content`
 * (plain text, one line per block, list markers kept) is derived from the same
 * document on every change; the list, search and the server read `content`, the
 * editor reads `bodyState`. Opening a note never rewrites its text.
 */

/**
 * Every device seeds an old note with this same client id, so two devices that
 * seed the same server-confirmed text produce identical operations and a merge
 * does not duplicate the text (step 18d).
 */
const SEED_CLIENT_ID = 1;

/**
 * Bump this only when the Markdown-to-document converter changes. It is stored on a note when
 * it is seeded, and a note that already has a body is never converted again (step 18d).
 */
export const SEED_CONVERTER_VERSION = 1;

/** The origin of the one transaction that builds a seed. */
export const SEED_ORIGIN = `seed:v${SEED_CONVERTER_VERSION}`;

/** Fold the saved updates into one clean state after this many writes. */
export const COMPACT_EVERY_UPDATES = 100;

const schema = getSchema(editorExtensions);

/** A body that has been opened or seeded. `seeded` is true when it was built from old text. */
export interface OpenedBody {
  doc: Y.Doc;
  /** The encoded state the doc was opened from. */
  state: Uint8Array;
  seeded: boolean;
}

/**
 * The one-time conversion (12b). Deterministic: the same text always gives the
 * same bytes. Pass only server-confirmed content when the note has a serverId.
 */
export function seedBodyState(content: string): Uint8Array {
  const doc = new Y.Doc();
  doc.clientID = SEED_CLIENT_ID;
  doc.transact(() => {
    prosemirrorJSONToYXmlFragment(schema, textToDoc(content), doc.getXmlFragment(BODY_FIELD));
  }, SEED_ORIGIN);
  const state = Y.encodeStateAsUpdate(doc);
  doc.destroy();
  return state;
}

export function docFromState(state: Uint8Array): Y.Doc {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, state);
  return doc;
}

/**
 * The Y.Doc to edit. Uses the saved `bodyState` when there is one. Otherwise
 * builds it once from the old text. Never writes: the caller saves a seeded
 * state, and only when the user opens the note (never on a list render).
 *
 * A clean row whose text no longer matches its saved body had its text
 * replaced by the server (another device, or AI tidy). That text is carried
 * into the saved body, so voice clips and links stay where they were. If it
 * cannot be carried, a body with voice clips is kept as it was (the clips are
 * the user's; their next edit wins), and any other body is rebuilt from the text.
 */
export function openBody(row: { content: string; bodyState?: Uint8Array | null }): OpenedBody {
  if (row.bodyState) {
    const doc = docFromState(row.bodyState);
    if (bodyToPlainText(doc) === row.content) return { doc, state: row.bodyState, seeded: false };

    if (rebaseBody(doc, row.content)) {
      return { doc, state: Y.encodeStateAsUpdate(doc), seeded: false };
    }
    doc.destroy();

    const kept = docFromState(row.bodyState);
    if (hasVoiceClip(kept)) return { doc: kept, state: row.bodyState, seeded: false };
    kept.destroy();
  }
  const state = seedBodyState(row.content);
  return { doc: docFromState(state), state, seeded: true };
}

/**
 * The next value for `bodyState`: the new update appended to the saved one,
 * and every COMPACT_EVERY_UPDATES writes the whole document re-encoded.
 */
export function nextBodyState(
  doc: Y.Doc,
  previous: Uint8Array | null | undefined,
  update: Uint8Array,
  updatesSinceCompaction: number,
): { state: Uint8Array; updatesSinceCompaction: number } {
  if (!previous || updatesSinceCompaction + 1 >= COMPACT_EVERY_UPDATES) {
    return { state: Y.encodeStateAsUpdate(doc), updatesSinceCompaction: 0 };
  }
  return {
    state: Y.mergeUpdates([previous, update]),
    updatesSinceCompaction: updatesSinceCompaction + 1,
  };
}

function toDoc(source: Y.Doc | Uint8Array): Y.Doc {
  return source instanceof Y.Doc ? source : docFromState(source);
}

function toJson(source: Y.Doc | Uint8Array): JSONContent {
  return yXmlFragmentToProsemirrorJSON(toDoc(source).getXmlFragment(BODY_FIELD)) as JSONContent;
}

/** `content`: derived from the body in the same write. Also used by Copy as text. */
export function bodyToPlainText(source: Y.Doc | Uint8Array): string {
  return docToText(toJson(source));
}

/* ---------- Carrying server text into a saved body ---------- */

const LIST_NODES = new Set(['bulletList', 'orderedList']);

/** A line that textToDoc would turn into a list item. */
const LIST_LINE = /^(?:[-*] |\d+\. )/;

/** Largest diff table worked out in full; past it the change is not carried. */
const MAX_DIFF_CELLS = 1_000_000;

/** One line of `content`, and the paragraph in the body that holds it. */
interface Slot {
  paragraph: Y.XmlElement;
  /** What docToText writes before the text: a list marker, or ''. */
  marker: string;
  /** The top-level block the line is in. */
  block: Y.XmlElement;
  lastOfBlock: boolean;
}

type DiffOp =
  | { kind: 'equal'; a: number; b: number }
  | { kind: 'delete'; a: number }
  | { kind: 'insert'; b: number };

/** Longest-common-subsequence diff. Null when the inputs are too big to compare. */
function diff<T>(a: readonly T[], b: readonly T[]): DiffOp[] | null {
  const width = b.length + 1;
  if ((a.length + 1) * width > MAX_DIFF_CELLS) return null;

  const table = new Uint32Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i * width + j] =
        a[i] === b[j]
          ? (table[(i + 1) * width + j + 1] ?? 0) + 1
          : Math.max(table[(i + 1) * width + j] ?? 0, table[i * width + j + 1] ?? 0);
    }
  }

  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    const skipOld = (table[(i + 1) * width + j] ?? 0) >= (table[i * width + j + 1] ?? 0);
    if (i < a.length && j < b.length && a[i] === b[j]) {
      ops.push({ kind: 'equal', a: i, b: j });
      i += 1;
      j += 1;
    } else if (j >= b.length || (i < a.length && skipOld)) {
      ops.push({ kind: 'delete', a: i });
      i += 1;
    } else {
      ops.push({ kind: 'insert', b: j });
      j += 1;
    }
  }
  return ops;
}

/**
 * The paragraph's one text node, null for an empty paragraph, undefined for
 * anything else (a line break, an inline node).
 */
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

/** The body's lines in the order docToText writes them. Null for a shape this cannot follow. */
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

/**
 * Turns the paragraph's text from `from` into `to`, character by character,
 * so untouched text keeps its links.
 */
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

  // Each change: at an offset in the old text, delete some, insert some.
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

  // Last first, so every offset still points at the old text.
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

function hasVoiceClip(doc: Y.Doc): boolean {
  return doc
    .getXmlFragment(BODY_FIELD)
    .toArray()
    .some((block) => block instanceof Y.XmlElement && block.nodeName === 'voiceClip');
}

/**
 * Changes `doc` so its text is `content`, touching only the lines that differ.
 * Voice clips, links and list structure stay. Handles what other devices and
 * AI tidy do: edit a line, add or remove plain lines. Returns false for
 * anything else (adding list lines, a line break inside a paragraph, a very
 * large change), and the caller then uses its fallback. `doc` may be partly
 * changed when this returns false, so the caller must discard it.
 */
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

      // One run of changes: removed old lines, then added new ones.
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
        // Only a whole top-level paragraph can go; anything inside a list is not carried.
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

/* ---------- Markdown export (never used for storage) ---------- */

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
    const href = node.marks?.find((mark) => mark.type === 'link')?.attrs?.['href'];
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

/** For export. Escapes typed `*`, `_`, `#` and `1.` so they stay literal text. */
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
