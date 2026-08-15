import { Link, useParams } from 'react-router';

import { useAuth } from '@/app/providers/auth-context';
import { NoteEditorHost } from '@/features/editor/components/NoteEditorHost';
import { parseNoteId, useNote } from '@/features/notes/hooks/useNote';
import { Spinner } from '@/design-system/components/Spinner/Spinner';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './NoteDetail.css';

export function NoteDetailPage() {
  const { noteId: noteIdParam } = useParams();
  const serverId = parseNoteId(noteIdParam);

  const state = useNote(serverId);
  const { state: authState } = useAuth();
  const currentUserId =
    authState.status === 'authenticated' || authState.status === 'refreshing'
      ? authState.user.id
      : null;

  const title = state.status === 'ready' ? state.row.title.trim() : '';
  useDocumentTitle(title === '' ? 'Untitled note' : title);

  return (
    <article className="note-detail">
      <nav className="note-detail__back">
        <Link to="/notes">← All notes</Link>
        {/*
          serverId, not localId — sharing is a grant on the SERVER's note
          row (features/sharing's whole surface is /notes/{noteId}/shares),
          so a note that has never synced has nothing to point this at yet.
        */}
        {state.status === 'ready' && state.row.serverId !== null ? (
          <Link className="note-detail__share-link" to={`/notes/${String(state.row.serverId)}/share`}>
            Share
          </Link>
        ) : null}
      </nav>

      {state.status === 'loading' ? (
        <div className="note-detail__centre">
          <Spinner label="Loading this note" />
        </div>
      ) : null}

      {state.status === 'not-found' ? (
        <div className="note-detail__centre">
          <h1>Note not found</h1>
          {/* Vague because the server is: 404 means "no such note" OR "not
              yours", conflated so a distinct 403 cannot confirm one exists. */}
          <p className="note-detail__muted">
            This note doesn&apos;t exist, or it isn&apos;t available to you.
          </p>
          <Link to="/notes">Back to your notes</Link>
        </div>
      ) : null}

      {state.status === 'unavailable' ? (
        <div className="note-detail__centre" role="alert">
          <h1>Can&apos;t open this note</h1>
          {/*
            DISTINCT from not-found, and the distinction matters. This note is
            not on this device and the server is unreachable — we cannot tell
            whether it exists. Saying "not found" would be a confident claim
            about something we have no way to check, and the user would
            reasonably conclude they had lost it.
          */}
          <p className="note-detail__muted">
            You&apos;re offline and this note isn&apos;t saved on this device yet. It will open once
            you&apos;re back online.
          </p>
          <Link to="/notes">Back to your notes</Link>
        </div>
      ) : null}

      {state.status === 'ready' ? (
        <NoteEditorHost key={state.row.localId} row={state.row} currentUserId={currentUserId} />
      ) : null}
    </article>
  );
}
