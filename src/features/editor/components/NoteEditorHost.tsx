import { useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router';

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
  /** Optional content rendered inside the writing surface around the body. */
  contentAccessory?: ReactNode;
}

export function NoteEditorHost({ row, currentUserId, contentAccessory }: NoteEditorHostProps) {
  const navigate = useNavigate();
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
      void navigate(`/notes/${String(serverId)}`, {
        replace: true,
      });
    }
  }, [navigate, serverId]);

  if (editor.saveState.status === 'conflict') {
    return (
      <>
        <SaveIndicator state={editor.saveState} />
        <ConflictPanel
          conflict={editor.conflict}
          mine={{ content: editor.row.content }}
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

  /*
   * No word count here any more, and SaveIndicator renders nothing at all
   * for the routine states (its own doc comment explains why) — so this is
   * the ONLY thing that can sit above the editor, and only when there is
   * genuinely something worth a person's attention. The rest of the time
   * this renders nothing, and the note's own first line starts right at
   * the top of the writing surface.
   */
  return (
    <>
      <SaveIndicator state={editor.saveState} />

      <EditorSurface
        content={editor.row.content}
        focusKey={editor.row.localId}
        onContentChange={(value) => {
          editor.setDraft({ content: value });
          editor.markEdited();
        }}
        onBlur={() => {
          void editor.flush();
        }}
        contentAccessory={contentAccessory}
      />
    </>
  );
}