import type { Editor } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Doc } from 'yjs';

import '@/features/editor/components/EditorSurface/EditorSurface.css';
import { noteIn } from '@/design-system/motion/patterns';
import { noteBodyExtensions } from '@/features/editor/editorExtensions';
import { VoiceClipContext } from '@/features/editor/voiceClip/VoiceClipContext';
import { takeBodyFocus } from '@/features/notes/bodyFocus';

import { NoteAccessoryStrip } from './NoteAccessoryStrip';
import { NoteSelectionBar } from './NoteSelectionBar';

interface NoteBodyEditorProps {
  noteId: string;
  /** The note's body. The document is the only copy of the draft. */
  doc: Doc;
  /** Rendered inside the writing area, after the text. */
  contentAccessory?: ReactNode;
  /** Hands the editor to the host (the + menu needs it). Called with null on unmount. */
  onEditor?: ((editor: Editor | null) => void) | undefined;
}

/**
 * Step 12b to 12f: the note editor on a Y.Doc.
 *
 * The host mounts this with `key={bodyKey}`, so one editor lives for one body:
 * it is never swapped on a live instance. A note switch mounts a new one that
 * fades in over the same reserved height, so nothing jumps. Same classes as
 * EditorSurface, so the styling is defined once.
 */
export function NoteBodyEditor({ noteId, doc, contentAccessory, onEditor }: NoteBodyEditorProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const voiceContext = useMemo(() => ({ noteId }), [noteId]);

  const [extensions] = useState(() => noteBodyExtensions(doc));

  const editor = useEditor({
    extensions,
    // TipTap's injected stylesheet would sit outside the app's @layer system.
    injectCSS: false,
    autofocus: false,
    editorProps: {
      attributes: {
        class: 'editor-surface__content',
        'aria-label': 'Note content',
      },
    },
  });

  useLayoutEffect(() => {
    if (bodyRef.current) noteIn(bodyRef.current);
  }, []);

  useEffect(() => {
    onEditor?.(editor);
    return () => {
      onEditor?.(null);
    };
  }, [editor, onEditor]);

  // D-13: never focus on open. Only right after the user pressed New note.
  useEffect(() => {
    if (takeBodyFocus(noteId)) editor.commands.focus('end');
  }, [editor, noteId]);

  return (
    <div
      className="editor-surface"
      onMouseDown={(event) => {
        // Only the empty space around the text; clicks on the text itself are ProseMirror's.
        if (event.target !== event.currentTarget && event.target !== bodyRef.current) return;
        event.preventDefault();
        editor.commands.focus('end');
      }}
    >
      <div ref={bodyRef} className="editor-surface__body">
        <VoiceClipContext.Provider value={voiceContext}>
          <EditorContent editor={editor} />
        </VoiceClipContext.Provider>
        <NoteSelectionBar editor={editor} />
        <NoteAccessoryStrip editor={editor} />
        {contentAccessory}
      </div>
    </div>
  );
}
