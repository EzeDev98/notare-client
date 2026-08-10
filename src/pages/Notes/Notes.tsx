import { Link } from 'react-router';

import type { NoteView } from '@/features/notes/local/noteMappers';

import { NoteCard } from '@/features/notes/components/NoteCard/NoteCard';
import { NoteTabs } from '@/features/notes/components/NoteTabs/NoteTabs';
import { useDeleteNote } from '@/features/notes/hooks/useDeleteNote';
import { useNoteActions } from '@/features/notes/hooks/useNoteActions';
import { useNotes } from '@/features/notes/hooks/useNotes';
import { Button } from '@/design-system/components/Button/Button';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './Notes.css';

export function NotesPage({ archived = false }: { archived?: boolean } = {}) {
  useDocumentTitle(archived ? 'Archived' : 'Notes');

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

  return (
    <section className="notes">
      <header className="notes__header">
        <h1>{archived ? 'Archived' : 'Notes'}</h1>
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
      </header>

      <NoteTabs />

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
            <NoteCard key={note.localId} note={note} actions={actions} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
