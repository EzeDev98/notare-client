import { useEffect } from 'react';

import { ConflictPanel } from '@/features/editor/components/ConflictPanel/ConflictPanel';
import { EditorSurface } from '@/features/editor/components/EditorSurface/EditorSurface';
import { SaveIndicator } from '@/features/editor/components/SaveIndicator/SaveIndicator';
import { useEditorShortcuts } from '@/features/editor/hooks/useEditorShortcuts';
import { useNoteEditor } from '@/features/editor/hooks/useNoteEditor';
import type { NoteResponse } from '@/features/notes/types';

interface NoteEditorHostProps {
  /** Null for a note that does not exist yet. */
  note: NoteResponse | null;
  /**
   * Used ONLY to word the conflict heading — "on another device" versus "by
   * someone else". A prop rather than useAuth, so the editor is testable
   * without a session.
   */
  currentUserId: number | null;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

export function NoteEditorHost({ note, currentUserId }: NoteEditorHostProps) {
  const editor = useNoteEditor(note);

  useEditorShortcuts({ onSave: editor.flush });

  const createdId = editor.state.noteId;

  /*
   * Once a new note has an id, correct the URL — WITHOUT navigating.
   *
   * navigate('/notes/42', { replace: true }) would be the obvious call and
   * would remount this component, because 6D keys the host on note id. Every
   * character typed since the POST went out would be discarded.
   *
   * history.replaceState changes the address without a navigation: React
   * Router listens for popstate, not replaceState. The URL becomes correct and
   * reloadable; the draft survives.
   */
  useEffect(() => {
    if (note === null && createdId !== null && window.location.pathname === '/notes/new') {
      window.history.replaceState(null, '', `/notes/${String(createdId)}`);
    }
  }, [note, createdId]);

  if (editor.saveState.status === 'conflict') {
    return (
      <>
        <SaveIndicator state={editor.saveState} />
        <ConflictPanel
          conflict={editor.conflict}
          mine={editor.state.draft}
          byAnotherDevice={
            currentUserId !== null &&
            editor.conflict.status === 'ready' &&
            editor.conflict.theirs.lastModifiedBy === currentUserId
          }
          onKeepMine={editor.keepMine}
          onUseTheirs={editor.useTheirs}
          onKeepBoth={editor.keepBoth}
        />
      </>
    );
  }

  const words = countWords(editor.state.draft.content);

  return (
    <>
      <div className="note-detail__status">
        <SaveIndicator state={editor.saveState} />
        {/* Quiet, and absent until there is something to count — a "0 words"
            label on a blank page is chrome with nothing to say. */}
        {words > 0 ? (
          <p className="note-detail__words">
            {words} {words === 1 ? 'word' : 'words'}
          </p>
        ) : null}
      </div>

      <EditorSurface
        title={editor.state.draft.title}
        content={editor.state.draft.content}
        onTitleChange={(value) => {
          editor.setDraft({ title: value });
          editor.markEdited();
        }}
        onContentChange={(value) => {
          editor.setDraft({ content: value });
          editor.markEdited();
        }}
        // Blur flushes: clicking away is a strong signal a thought is
        // finished, and 1.2 more seconds of "Unsaved changes" reads as the app
        // not keeping up.
        onBlur={() => {
          void editor.flush();
        }}
      />
    </>
  );
}
