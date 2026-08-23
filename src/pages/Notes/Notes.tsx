import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import type { NoteView } from '@/features/notes/local/noteMappers';

import { useAuth } from '@/app/providers/auth-context';
import { NotebookPen } from 'lucide-react';
import { Modal } from '@/design-system/components/Modal/Modal';
import { NoteCard } from '@/features/notes/components/NoteCard/NoteCard';
import { NoteContextMenu, type NoteContextMenuActions } from '@/features/notes/components/NoteContextMenu/NoteContextMenu';
import { NoteTabs } from '@/features/notes/components/NoteTabs/NoteTabs';
import { useDeleteNote } from '@/features/notes/hooks/useDeleteNote';
import { useNoteActions } from '@/features/notes/hooks/useNoteActions';
import { useNotes } from '@/features/notes/hooks/useNotes';
import { createLocalNote } from '@/features/notes/local/noteMappers';
import { noteRepository, outboxRepository } from '@/features/notes/local/noteRepository';
import { Button } from '@/design-system/components/Button/Button';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './Notes.css';

export function NotesPage({ archived = false }: { archived?: boolean } = {}) {
  useDocumentTitle(archived ? 'Archived' : 'Notes');

  const navigate = useNavigate();
  const { state: authState } = useAuth();
  const { notes, refreshing, refreshError, refresh } = useNotes({ archived });

  /*
   * The hooks take no callbacks now. Both write to Dexie, and `notes` above is
   * a live query over the same table — the list updates because the data
   * changed, not because this component was told to update it.
   */
  const { togglePin, setArchived } = useNoteActions();
  const deleteNote = useDeleteNote();

  const actions = {
    onTogglePin: (note: NoteView) => void togglePin(note),
    onToggleArchive: (note: NoteView) => void setArchived(note, !note.archived),
    onDelete: (note: NoteView) => void deleteNote(note),
  };

  /*
   * The card's own long-press / right-click / two-finger-click menu — the
   * SAME six actions AppLayout's desktop sidebar rail wired up, added here
   * too because this list (not the rail) is what actually renders on any
   * viewport under the 1024px sidebar breakpoint, and is the primary note
   * list even above it. Wiring the menu into the rail alone left it
   * unreachable everywhere the rail itself is CSS-hidden.
   */
  const [contextMenu, setContextMenu] = useState<{ note: NoteView; x: number; y: number } | null>(
    null,
  );
  const [noteToDelete, setNoteToDelete] = useState<NoteView | null>(null);

  function handleNoteContextMenu(note: NoteView, x: number, y: number) {
    setContextMenu({ note, x, y });
  }

  // Mirrors AppLayout's own handleDuplicateNote: a local CREATE row plus an
  // outbox entry, which the existing push engine picks up like any other
  // offline-authored note — see that file's own comment for why this does
  // NOT go through noteRepository.listDirty().
  async function handleDuplicateNote(note: NoteView) {
    if (authState.status !== 'authenticated' && authState.status !== 'refreshing') return;

    const row = createLocalNote(authState.user.id, { content: note.content });

    await noteRepository.put(row);
    await outboxRepository.enqueueCreate({
      localId: row.localId,
      clientId: row.clientId,
      content: row.content,
    });

    void navigate(`/notes/local/${row.localId}`, { state: { skipEnterAnimation: true } });
  }

  async function handleConfirmDelete() {
    if (!noteToDelete) return;
    const toDelete = noteToDelete;
    setNoteToDelete(null);
    await deleteNote(toDelete);
  }

  const noteContextMenuActions: NoteContextMenuActions = {
    // /notes/new already does exactly this (creates a blank local row, then
    // navigates) with no empty-note guard — matching the existing "New
    // note" button on this same page, which is a plain Link to that route.
    onNewNote: () => {
      void navigate('/notes/new');
    },
    onDuplicate: (note) => {
      void handleDuplicateNote(note);
    },
    onShare: (note) => {
      if (note.serverId === null) return;
      void navigate(`/notes/${String(note.serverId)}/share`);
    },
    onTogglePin: (note) => {
      void togglePin(note);
    },
    onToggleArchive: (note) => {
      void setArchived(note, !note.archived);
    },
    onDelete: (note) => {
      setNoteToDelete(note);
    },
  };

  return (
    <section className={archived ? 'notes notes--archived' : 'notes'}>
      <header className="notes__header">
        <h1>{archived ? 'Archived' : 'Notes'}</h1>
        {archived ? null : (
          <div className="notes__header-actions">
            <Link className="notes__search" to="/search">
              Search
            </Link>
            <Link to="/notes/new">
              <Button variant="primary" size="sm">
                New note
              </Button>
            </Link>
          </div>
        )}
      </header>

      {archived ? null : <NoteTabs />}

      {/*
        A BANNER, not a screen. Whatever is in local storage stays visible —
        the notes are readable offline and the failure is an aside. Before
        Step 7 this was an error state that replaced everything.
      */}
      {refreshError !== null ? (
        <p className="notes__offline" role="status">
          {refreshError}{' '}
          <button className="notes__retry" type="button" onClick={refresh}>
            Try again
          </button>
        </p>
      ) : null}

      {/*
        `notes === undefined` means Dexie has not answered yet — a few
        milliseconds, and rendering a spinner for it would flash on every
        mount. `notes.length === 0` is a genuinely empty account. Conflating
        the two shows an empty state before the query has run.
      */}
      {notes !== undefined && notes.length === 0 && !refreshing ? (
        <div className="notes__centre">
          <h2 className="notes__empty-title">Nothing here yet</h2>
          <p className="notes__empty-body">
            Your notes will appear here. Start with a thought, a list, or whatever is on your mind.
          </p>
          <Link className="notes__empty-action" to="/notes/new">
            <Button variant="primary">Write your first note</Button>
          </Link>
        </div>
      ) : null}

      {notes !== undefined && notes.length > 0 ? (
        <ul className="notes__list" role="list">
          {notes.map((note) => (
            <NoteCard
              key={note.localId}
              note={note}
              actions={actions}
              onContextMenu={handleNoteContextMenu}
              isMenuOpen={contextMenu?.note.localId === note.localId}
              // Conditionally spread, not `titleMaxLength={archived ? 18 :
              // undefined}` — NoteCardProps declares `titleMaxLength?:
              // number`, and under `exactOptionalPropertyTypes: true` that
              // means the prop may be OMITTED, not explicitly set to
              // `undefined`. Omitting it here (rather than widening the
              // prop's type to `number | undefined`) keeps that distinction
              // meaningful for every other caller of NoteCard, instead of
              // loosening the type everywhere to accommodate one call site.
              {...(archived ? { titleMaxLength: 18 } : {})}
            />
          ))}
        </ul>
      ) : null}

      {noteToDelete ? (
        <Modal
          icon={<NotebookPen aria-hidden="true" />}
          description="Delete this note? The note will be moved to Trash."
          secondaryAction={{
            label: 'Cancel',
            onClick: () => {
              setNoteToDelete(null);
            },
          }}
          primaryAction={{
            label: 'Delete',
            onClick: () => {
              void handleConfirmDelete();
            },
          }}
          onClose={() => {
            setNoteToDelete(null);
          }}
        />
      ) : null}

      {contextMenu ? (
        <NoteContextMenu
          note={contextMenu.note}
          x={contextMenu.x}
          y={contextMenu.y}
          actions={noteContextMenuActions}
          onClose={() => {
            setContextMenu(null);
          }}
        />
      ) : null}
    </section>
  );
}