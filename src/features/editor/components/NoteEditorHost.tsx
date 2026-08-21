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

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
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
        {/*
          ALWAYS mounted, never `words > 0 ? … : null`. Toggling this
          element's presence based on content length is exactly what made
          navigating between an empty note and a non-empty one visibly
          jump: the status bar's height changed on every such switch, while
          content<->content and empty<->empty never touched this at all.
          `visibility: hidden` removes it from view (and from the
          accessibility tree) without removing it from layout, so the
          height of `.note-detail__status` is now constant regardless of
          which note is open.
        */}
        <p className="note-detail__words" data-empty={words === 0 ? 'true' : undefined}>
          {words > 0 ? `${String(words)} ${words === 1 ? 'word' : 'words'}` : '\u00A0'}
        </p>
      </div>

      <EditorSurface
        title={editor.row.title}
        content={editor.row.content}
        hideTitle
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
        contentAccessory={contentAccessory}
      />
    </>
  );
}
