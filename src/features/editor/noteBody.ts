/** The note body as a Yjs document: open, seed and save. */
import { getSchema } from '@tiptap/core';
import { prosemirrorJSONToYXmlFragment } from '@tiptap/y-tiptap';
import * as Y from 'yjs';

import { BODY_FIELD, editorExtensions } from '@/features/editor/editorExtensions';
import { bodyToPlainText, docFromState, hasVoiceClip } from '@/features/editor/bodyText';
import { rebaseBody } from '@/features/editor/bodyRebase';
import { textToDoc } from '@/features/editor/plainTextBody';

export { bodyToPlainText, docFromState };

const SEED_CLIENT_ID = 1;

export const SEED_CONVERTER_VERSION = 1;

export const SEED_ORIGIN = `seed:v${SEED_CONVERTER_VERSION}`;

export const COMPACT_EVERY_UPDATES = 100;

const schema = getSchema(editorExtensions);

export interface OpenedBody {
  doc: Y.Doc;
  state: Uint8Array;
  seeded: boolean;
}

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
