import type { Editor } from '@tiptap/core';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Awareness } from 'y-protocols/awareness';
import type { Doc } from 'yjs';

import '@/features/editor/components/EditorSurface/EditorSurface.css';
import { NOTE_COUNTER_FROM, NOTE_MAX_CHARS } from '@/core/config/timings';
import { noteIn } from '@/design-system/motion/patterns';
import { LengthCounter, useToast } from '@/design-system/ui';
import type { CurrentUser } from '@/features/auth/types';
import { RemoteCarets } from '@/features/collab/RemoteCarets';
import { usePublishPresence } from '@/features/collab/usePublishPresence';
import { EDITOR_COPY } from '@/features/editor/editorContent';
import { collaborativeExtensions } from '@/features/editor/editorExtensions';
import { docToText } from '@/features/editor/plainTextBody';
import { VoiceClipContext } from '@/features/editor/voiceClip/VoiceClipContext';
import { takeBodyFocus } from '@/features/notes/bodyFocus';

import { NoteAccessoryStrip } from './NoteAccessoryStrip';
import { NoteSelectionBar } from './NoteSelectionBar';

interface NoteBodyEditorProps {
  noteId: string;
  /** The note's body. The document is the only copy of the draft. */
  doc: Doc;
  readOnly?: boolean;
  /** Whether the Transcribe button shows on voice blocks. */
  canTranscribe?: boolean;
  /** Rendered inside the writing area, after the text. */
  contentAccessory?: ReactNode;
  /** Hands the editor to the host (the + menu needs it). Called with null on unmount. */
  onEditor?: ((editor: Editor | null) => void) | undefined;
  /** Live presence for this note (step 16d). Without it the note has no carets. */
  awareness?: Awareness | undefined;
  /** Who we are, told to the others. */
  user?: CurrentUser | null | undefined;
}

/**
 * Step 12b to 12f: the note editor on a Y.Doc.
 *
 * The host mounts this with `key={bodyKey}`, so one editor lives for one body:
 * it is never swapped on a live instance. A note switch mounts a new one that
 * fades in over the same reserved height, so nothing jumps. Same classes as
 * EditorSurface, so the styling is defined once.
 */
export function NoteBodyEditor({
  noteId,
  doc,
  readOnly = false,
  canTranscribe = false,
  contentAccessory,
  onEditor,
  awareness,
  user = null,
}: NoteBodyEditorProps) {
  const { toast } = useToast();
  const bodyRef = useRef<HTMLDivElement>(null);
  const voiceContext = useMemo(
    () => ({ noteId, canEdit: !readOnly, canTranscribe }),
    [noteId, readOnly, canTranscribe],
  );

  const [extensions] = useState(() =>
    collaborativeExtensions(doc, (kind) => {
      // Typing at the limit is shown by the counter. A paste needs its own message.
      if (kind === 'paste') toast(EDITOR_COPY.pasteBlocked, { tone: 'error' });
    }),
  );

  const editor = useEditor({
    extensions,
    editable: !readOnly,
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

  // The same length the server counts (the derived `content`).
  const count = useEditorState({
    editor,
    selector: ({ editor: current }) => docToText(current.getJSON()).length,
  });

  usePublishPresence(awareness, editor, user, !readOnly);

  useLayoutEffect(() => {
    if (bodyRef.current) noteIn(bodyRef.current);
  }, []);

  useEffect(() => {
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  useEffect(() => {
    onEditor?.(editor);
    return () => {
      onEditor?.(null);
    };
  }, [editor, onEditor]);

  // D-13: never focus on open. Only right after the user pressed New note.
  useEffect(() => {
    if (readOnly) return;
    if (takeBodyFocus(noteId)) editor.commands.focus('end');
  }, [editor, noteId, readOnly]);

  return (
    <div className="editor-surface">
      <div ref={bodyRef} className="editor-surface__body">
        <VoiceClipContext.Provider value={voiceContext}>
          <EditorContent editor={editor} />
        </VoiceClipContext.Provider>
        {awareness && !readOnly ? <RemoteCarets editor={editor} awareness={awareness} /> : null}
        {readOnly ? null : <NoteSelectionBar editor={editor} />}
        {readOnly ? null : <NoteAccessoryStrip editor={editor} />}
        {readOnly ? null : (
          <div className="editor-surface__counter">
            <LengthCounter count={count} limit={NOTE_MAX_CHARS} from={NOTE_COUNTER_FROM} />
          </div>
        )}
        {contentAccessory}
      </div>
    </div>
  );
}
