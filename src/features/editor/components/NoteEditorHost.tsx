import { useEffect } from 'react';

import { ConflictPanel } from '@/features/editor/components/ConflictPanel/ConflictPanel';
import { EditorSurface } from '@/features/editor/components/EditorSurface/EditorSurface';
import { SaveIndicator } from '@/features/editor/components/SaveIndicator/SaveIndicator';
import { useEditorShortcuts } from '@/features/editor/hooks/useEditorShortcuts';
import { useNoteEditor } from '@/features/editor/hooks/useNoteEditor';
import type { NoteRow } from '@/features/notes/local/noteRow';

interface NoteEditorHostProps {
  /** The local row. Exists before any server has seen this note. */
  row: NoteRow;
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

export function NoteEditorHost({ row, currentUserId }: NoteEditorHostProps) {
  const editor = useNoteEditor(row);

  useEditorShortcuts({ onSave: editor.flush });

  const serverId = editor.row.serverId;

  /*
   * Correct the URL once a new note has a server id — WITHOUT navigating.
   *
   * navigate() would remount this component (the key on localId is stable, but
   * the route change unmounts the page), discarding nothing now that Dexie
   * holds the draft — but still causing a visible flicker. replaceState
   * updates the address without a navigation: React Router listens for
   * popstate, not replaceState.
   */
  useEffect(() => {
    if (serverId !== null && window.location.pathname.startsWith('/notes/local/')) {
      window.history.replaceState(null, '', `/notes/${String(serverId)}`);
    }
  }, [serverId]);

  if (editor.saveState.status === 'conflict') {
    return (
      <>
        <SaveIndicator state={editor.saveState} />
        <ConflictPanel
          conflict={editor.conflict}
          mine={{ title: editor.row.title, content: editor.row.content }}
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

  const words = countWords(editor.row.content);

  return (
    <>
      <div className="note-detail__status">
        <SaveIndicator state={editor.saveState} />
        {words > 0 ? (
          <p className="note-detail__words">
            {words} {words === 1 ? 'word' : 'words'}
          </p>
        ) : null}
      </div>

      <EditorSurface
        title={editor.row.title}
        content={editor.row.content}
        onTitleChange={(value) => {
          editor.setDraft({ title: value });
          editor.markEdited();
        }}
        onContentChange={(value) => {
          editor.setDraft({ content: value });
          editor.markEdited();
        }}
        onBlur={() => {
          void editor.flush();
        }}
      />
    </>
  );
}
