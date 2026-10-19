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
 */
export function openBody(row: { content: string; bodyState?: Uint8Array | null }): OpenedBody {
  const seeded = !row.bodyState;
  const state = row.bodyState ?? seedBodyState(row.content);
  return { doc: docFromState(state), state, seeded };
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
