/** The note body editor. */
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
  doc: Doc;
  contentAccessory?: ReactNode;
  onEditor?: ((editor: Editor | null) => void) | undefined;
}

export function NoteBodyEditor({ noteId, doc, contentAccessory, onEditor }: NoteBodyEditorProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const voiceContext = useMemo(() => ({ noteId }), [noteId]);

  const [extensions] = useState(() => noteBodyExtensions(doc));

  const editor = useEditor({
    extensions,
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

  useEffect(() => {
    if (takeBodyFocus(noteId)) editor.commands.focus('end');
  }, [editor, noteId]);

  return (
    <div
      className="editor-surface"
      onMouseDown={(event) => {
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
