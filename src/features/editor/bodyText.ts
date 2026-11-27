/** Reads a note body document: its plain text, its JSON and whether it holds a voice clip. */
import type { JSONContent } from '@tiptap/core';
import { yXmlFragmentToProsemirrorJSON } from '@tiptap/y-tiptap';
import * as Y from 'yjs';

import { BODY_FIELD } from '@/features/editor/editorExtensions';
import { docToText } from '@/features/editor/plainTextBody';

export function docFromState(state: Uint8Array): Y.Doc {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, state);
  return doc;
}

function toDoc(source: Y.Doc | Uint8Array): Y.Doc {
  return source instanceof Y.Doc ? source : docFromState(source);
}

export function toJson(source: Y.Doc | Uint8Array): JSONContent {
  return yXmlFragmentToProsemirrorJSON(toDoc(source).getXmlFragment(BODY_FIELD)) as JSONContent;
}

export function bodyToPlainText(source: Y.Doc | Uint8Array): string {
  return docToText(toJson(source));
}

export function hasVoiceClip(doc: Y.Doc): boolean {
  return doc
    .getXmlFragment(BODY_FIELD)
    .toArray()
    .some((block) => block instanceof Y.XmlElement && block.nodeName === 'voiceClip');
}
