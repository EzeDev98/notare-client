import { Link } from 'react-router';

import { NoteCard } from '@/features/notes/components/NoteCard/NoteCard';
import { NoteTabs } from '@/features/notes/components/NoteTabs/NoteTabs';
import { useDeleteNote } from '@/features/notes/hooks/useDeleteNote';
import { useNoteActions } from '@/features/notes/hooks/useNoteActions';
import { useNotes } from '@/features/notes/hooks/useNotes';
import { Button } from '@/design-system/components/Button/Button';
import { Spinner } from '@/design-system/components/Spinner/Spinner';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './Notes.css';

export function NotesPage({ archived = false }: { archived?: boolean } = {}) {
  useDocumentTitle(archived ? 'Archived' : 'Notes');

  const { state, loadingMore, loadMore, reload, removeOptimistically, applyUpdate } = useNotes({
    archived,
  });
  const deleteNote = useDeleteNote({ onRemove: removeOptimistically });
  const actions = useNoteActions({ onUpdated: applyUpdate, onRemoved: removeOptimistically });

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
        §37: loading, empty and error are three different answers to "why is
        there nothing here". Collapsing them into one spinner-or-blank leaves
        the user unable to tell a slow network from an empty account.
      */}

      {state.status === 'loading' ? (
        <div className="notes__centre">
          <Spinner label="Loading your notes" />
        </div>
      ) : null}

      {state.status === 'error' ? (
        <div className="notes__centre" role="alert">
          <p>{state.message}</p>
          <Button variant="secondary" onClick={reload}>
            Try again
          </Button>
        </div>
      ) : null}

      {state.status === 'ready' && state.notes.length === 0 ? (
        <div className="notes__centre">
          {/* Says what the screen is FOR and offers the action that fills it.
              "No notes" alone tells the user what they can already see. */}
          <h2 className="notes__empty-title">Nothing here yet</h2>
          <p className="notes__empty-body">
            Your notes will appear here. Start with a thought, a list, or whatever is on your mind.
          </p>
          <Link className="notes__empty-action" to="/notes/new">
            <Button variant="primary">Write your first note</Button>
          </Link>
        </div>
      ) : null}

      {state.status === 'ready' && state.notes.length > 0 ? (
        <>
          <ul className="notes__list" role="list">
            {state.notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onDelete={(noteId, title) => void deleteNote(noteId, title)}
                onTogglePin={(target) => void actions.setPinned(target)}
                onToggleArchive={(target) =>
                  void (archived ? actions.unarchive(target) : actions.archive(target))
                }
              />
            ))}
          </ul>

          {/*
            A polite live region announcing the count after each load.
            Appending twenty rows is obvious visually and completely silent to
            a screen reader — the user presses a button and, as far as they can
            tell, nothing happens.
          */}
          <p className="notes__count" role="status">
            Showing {state.notes.length} of {state.total}
          </p>

          {state.hasNext ? (
            <div className="notes__more">
              {/*
                An explicit button, not infinite scroll. Infinite scroll gives
                focus nowhere to land, puts anything below the list permanently
                out of a keyboard user's reach, and fires unpredictably with a
                screen reader. A button is reachable, keeps focus where the
                user put it, and reads as an ordinary control.
              */}
              <Button variant="secondary" loading={loadingMore} onClick={() => void loadMore()}>
                Load more
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
