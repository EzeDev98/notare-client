import { Link, useNavigate, useParams } from 'react-router';

import { useAuth } from '@/app/providers/auth-context';
import { NoteEditorHost } from '@/features/editor/components/NoteEditorHost';
import { useDeleteNote } from '@/features/notes/hooks/useDeleteNote';
import { parseNoteId, useNote } from '@/features/notes/hooks/useNote';
import { Button } from '@/design-system/components/Button/Button';
import { Spinner } from '@/design-system/components/Spinner/Spinner';
import { formatServerDateTimeAbsolute, formatServerDateTimeRelative } from '@/lib/time';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './NoteDetail.css';

/**
 * Hosts the editor for a loaded note.
 *
 * A separate component so that typing re-renders THIS and not the page around
 * it — the header, the delete button and the error states have no reason to
 * repaint per character.
 *
 * The key on the note id remounts the editor when the route changes to a
 * different note. Without it, React reuses the component and the draft state
 * from the previous note leaks into the next one.
 */
export function NoteDetailPage() {
  const { state: authState } = useAuth();
  const currentUserId =
    authState.status === 'authenticated' || authState.status === 'refreshing'
      ? authState.user.id
      : null;

  const { noteId: noteIdParam } = useParams();
  const noteId = parseNoteId(noteIdParam);

  const { state, reload } = useNote(noteId);
  const navigate = useNavigate();

  /*
   * The same delete-with-undo the list uses. Only onRemove differs: there it
   * drops a row and reinserts it; here it navigates away and back.
   *
   * Going through the hook is not just the lint rule — it is why the toast
   * wording, the request order and the failure handling cannot drift between
   * the two screens that delete a note.
   */
  const deleteNote = useDeleteNote({
    onRemove: (id) => {
      void navigate('/notes', { replace: true });
      return () => {
        void navigate(`/notes/${String(id)}`);
      };
    },
  });

  const title = state.status === 'ready' ? (state.note.title?.trim() ?? '') : '';
  useDocumentTitle(title === '' ? 'Untitled note' : title);

  return (
    <article className="note-detail">
      <nav className="note-detail__back">
        <Link to="/notes">← All notes</Link>
      </nav>

      {state.status === 'loading' ? (
        <div className="note-detail__centre">
          <Spinner label="Loading this note" />
        </div>
      ) : null}

      {state.status === 'not-found' ? (
        <div className="note-detail__centre">
          <h1>Note not found</h1>
          {/*
            Deliberately vague, because the server is. A 404 here means "no
            such note" OR "not yours" — the two are conflated so that a
            distinct 403 cannot confirm a note exists. Saying "this note was
            deleted" would be a confident guess, and wrong half the time.
          */}
          <p className="note-detail__muted">
            This note doesn&apos;t exist, or it isn&apos;t available to you.
          </p>
          <Link to="/notes">Back to your notes</Link>
        </div>
      ) : null}

      {state.status === 'error' ? (
        <div className="note-detail__centre" role="alert">
          <p>{state.message}</p>
          <Button variant="secondary" onClick={reload}>
            Try again
          </Button>
        </div>
      ) : null}

      {state.status === 'ready' ? (
        <>
          <header className="note-detail__header">
            <div className="note-detail__actions">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void deleteNote(state.note.id, state.note.title)}
              >
                Delete
              </Button>
            </div>
          </header>

          <p className="note-detail__meta">
            {state.note.pinned ? <span className="note-detail__badge">Pinned</span> : null}
            <time
              dateTime={state.note.updatedAt}
              title={formatServerDateTimeAbsolute(state.note.updatedAt)}
            >
              Updated {formatServerDateTimeRelative(state.note.updatedAt)}
            </time>
          </p>

          {/*
            The reading view from 5D is now the writing surface, inside the
            same shell — same measure, same type scale, same error states.
            Building the reading experience first meant judging the typography
            without the save machinery confusing the question.
          */}
          {/*
            THE KEY IS LOAD-BEARING, not a list-rendering habit.
            
            useNoteEditor passes `note` to useState, which uses it ONLY as a
            seed — later values are ignored. Navigate from note 5 to note 9
            without this component unmounting and the draft still holds note
            5's text and version while pointing at note 9's id, and the next
            auto-save writes one note's content into the other.
            
            Whether it unmounts otherwise depends on whether the fetch happens
            to pass through a loading state, which is timing rather than
            design. The key makes it structural: React discards the instance
            and builds a fresh one.
          */}
          <NoteEditorHost key={state.note.id} note={state.note} currentUserId={currentUserId} />
        </>
      ) : null}
    </article>
  );
}
