/** The editor's extensions. */
import { wrappingInputRule } from '@tiptap/core';
import Collaboration from '@tiptap/extension-collaboration';
import Link from '@tiptap/extension-link';
import { BulletList } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extensions';
import StarterKit from '@tiptap/starter-kit';
import type { Doc } from 'yjs';

import { EDITOR_COPY } from '@/features/editor/editorContent';
import { VoiceClip } from '@/features/editor/voiceClip/VoiceClip';

export const BODY_FIELD = 'default';

const BulletListDashStar = BulletList.extend({
  addInputRules() {
    return [wrappingInputRule({ find: /^\s*([-*])\s$/, type: this.type })];
  },
});

function baseExtensions(builtInUndo: boolean) {
  return [
    StarterKit.configure({
      heading: false,
      bold: false,
      italic: false,
      strike: false,
      code: false,
      codeBlock: false,
      blockquote: false,
      horizontalRule: false,
      underline: false,
      bulletList: false,
      link: false,
      undoRedo: builtInUndo ? {} : false,
      trailingNode: false,
    }),
    BulletListDashStar,
    Link.configure({ openOnClick: false }),
    Placeholder.configure({ placeholder: EDITOR_COPY.placeholder, showOnlyCurrent: false }),
  ];
}

export const editorExtensions = baseExtensions(true);

export function noteBodyExtensions(document: Doc) {
  return [
    ...baseExtensions(false),
    VoiceClip,
    Collaboration.configure({ document, field: BODY_FIELD }),
  ];
}
