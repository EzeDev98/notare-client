import { Extension, type JSONContent } from '@tiptap/core';
import type { Node as ProseNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { ySyncPluginKey } from '@tiptap/y-tiptap';

import { NOTE_MAX_CHARS } from '@/core/config/timings';
import { docToText } from '@/features/editor/plainTextBody';

export type BlockedInput = 'paste' | 'input';

interface LengthLimitOptions {
  max: number;
  onBlocked: ((kind: BlockedInput) => void) | undefined;
}

/** The same count the server sees: the derived `content` (list markers and line breaks included). */
export const noteLength = (doc: ProseNode): number => docToText(doc.toJSON() as JSONContent).length;

/**
 * Step 12f (D-07): input that would pass NOTE_MAX_CHARS is refused whole. Text is
 * never cut silently. A change that does not make the note longer is always
 * allowed, and so is anything arriving from the Y.Doc (undo, other devices).
 */
export const NoteLengthLimit = Extension.create<LengthLimitOptions>({
  name: 'noteLengthLimit',

  addOptions() {
    return { max: NOTE_MAX_CHARS, onBlocked: undefined };
  },

  addProseMirrorPlugins() {
    const { max, onBlocked } = this.options;

    return [
      new Plugin({
        key: new PluginKey('noteLengthLimit'),
        filterTransaction: (tr, state) => {
          if (!tr.docChanged || tr.getMeta(ySyncPluginKey)) return true;

          const next = noteLength(tr.doc);
          if (next <= max || next <= noteLength(state.doc)) return true;

          onBlocked?.(tr.getMeta('uiEvent') === 'paste' ? 'paste' : 'input');
          return false;
        },
      }),
    ];
  },
});
