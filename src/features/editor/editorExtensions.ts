import { wrappingInputRule } from '@tiptap/core';
import Collaboration from '@tiptap/extension-collaboration';
import Link from '@tiptap/extension-link';
import { BulletList } from '@tiptap/extension-list';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import { Placeholder } from '@tiptap/extensions';
import StarterKit from '@tiptap/starter-kit';
import type { Doc } from 'yjs';

import { EDITOR_COPY } from '@/features/editor/editorContent';
import { NoteLengthLimit, type BlockedInput } from '@/features/editor/noteLengthLimit';
import { VoiceClip } from '@/features/editor/voiceClip/VoiceClip';

/**
 * Step 12a/12b: the editor stack (master 6.4, O-03, D-08).
 *
 * Blocks: paragraph, bullet list, numbered list, checklist. No Heading, no
 * bold, italic, strike, code, code block, blockquote or horizontal rule, so
 * `#` stays literal text. Markdown shortcuts are exactly: `-` or `*` + space
 * (bullet), `1.` + space (numbered), `[]` or `[ ]` + space (checklist).
 *
 * StarterKit v3 bundles Link and Underline. Link is registered below on its
 * own, so it is switched off inside StarterKit to avoid a duplicate extension.
 */

/** The one XML fragment in a note's Y.Doc. */
export const BODY_FIELD = 'default';

// StarterKit's own bullet rule also accepts `+`. The master allows only - and *.
const BulletListDashStar = BulletList.extend({
  addInputRules() {
    return [wrappingInputRule({ find: /^\s*([-*])\s$/, type: this.type })];
  },
});

// The stock rule also accepts `[x] ` (pre-checked). Only `[]` and `[ ]` are allowed.
const ChecklistItem = TaskItem.extend({
  addInputRules() {
    return [wrappingInputRule({ find: /^\s*(\[ ?\])\s$/, type: this.type })];
  },
}).configure({ nested: false });

function baseExtensions(builtInUndo: boolean, onBlocked?: (kind: BlockedInput) => void) {
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
      // The Yjs undo manager replaces the built-in history in the note editor.
      undoRedo: builtInUndo ? {} : false,
      // A trailing empty paragraph would make opening a note ending in a list
      // look like an edit. Enter on an empty list item leaves the list instead.
      trailingNode: false,
    }),
    BulletListDashStar,
    TaskList,
    ChecklistItem,
    // Clicking a link inside an editable note must place the caret, not navigate.
    Link.configure({ openOnClick: false }),
    // Shown by CSS only while the whole note is empty (O-20).
    Placeholder.configure({ placeholder: EDITOR_COPY.placeholder, showOnlyCurrent: false }),
    NoteLengthLimit.configure({ onBlocked }),
  ];
}

/** Plain editor with its own undo. Used by the shared-note page until step 18. */
export const editorExtensions = baseExtensions(true);

/** The note editor: the body lives in a Y.Doc, undo comes from Yjs. */
export function collaborativeExtensions(document: Doc, onBlocked?: (kind: BlockedInput) => void) {
  return [
    ...baseExtensions(false, onBlocked),
    VoiceClip,
    Collaboration.configure({ document, field: BODY_FIELD }),
  ];
}
