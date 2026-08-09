import { Link, useNavigate, useParams } from 'react-router';

import { useDeleteNote } from '@/features/notes/hooks/useDeleteNote';
import { parseNoteId, useNote } from '@/features/notes/hooks/useNote';
import { Button } from '@/design-system/components/Button/Button';
import { Spinner } from '@/design-system/components/Spinner/Spinner';
import { formatServerDateTimeAbsolute, formatServerDateTimeRelative } from '@/lib/time';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './NoteDetail.css';

export function NoteDetailPage() {
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
            <h1 className="note-detail__title">
              {title === '' ? <span className="note-detail__muted">Untitled</span> : title}
            </h1>

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
            Content as a TEXT NODE. React escapes it, so a note containing
            <script> displays those characters rather than executing anything —
            which is why nothing here reaches for dangerouslySetInnerHTML.

            Newlines survive through white-space: pre-wrap in CSS rather than
            through markup, so the text stays text.
          */}
          {state.note.content !== null && state.note.content.trim() !== '' ? (
            <div className="note-detail__content">{state.note.content}</div>
          ) : (
            <p className="note-detail__muted">This note is empty.</p>
          )}
        </>
      ) : null}
    </article>
  );
}
