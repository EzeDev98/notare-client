import { Link, useParams } from 'react-router';

import { useAuth } from '@/app/providers/auth-context';
import { NoteEditorHost } from '@/features/editor/components/NoteEditorHost';
import { useLocalNote } from '@/features/notes/hooks/useLocalNote';
import { Spinner } from '@/design-system/components/Spinner/Spinner';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './NoteDetail.css';

/**
 * A note that has not reached the server yet.
 *
 * Lives at /notes/local/:localId — see NoteCard's routing comment for why a
 * note with serverId === null links here, and NoteEditorHost's replaceState
 * effect for the other direction: the moment a serverId is assigned, the URL
 * moves itself to /notes/:serverId and NoteDetailPage takes over. This page
 * exists only to resolve THIS side of that lifecycle, including a page
 * refresh while still on it — Dexie is queried by localId, and nothing here
 * ever asks the server about a UUID it has never heard of.
 *
 * Deliberately its own page rather than a branch inside NoteDetailPage.
 * useNote(serverId) fetches from the server on every mount — correct for a
 * note that HAS a server id, wrong for one that doesn't. Reusing it here
 * would mean feeding it something that is not a serverId (exactly what
 * parseNoteId exists to reject) or teaching it to skip the fetch for some
 * inputs, which blurs the boundary the two identities were given on purpose.
 * A small dedicated hook (useLocalNote) keeps that boundary intact while
 * still ending in the same NoteEditorHost every other note uses.
 */
export function LocalNoteDetailPage() {
  const { localId } = useParams();
  const state = useLocalNote(localId);

  const { state: authState } = useAuth();
  const currentUserId =
    authState.status === 'authenticated' || authState.status === 'refreshing'
      ? authState.user.id
      : null;

  const title = state.status === 'ready' ? state.row.title.trim() : '';
  useDocumentTitle(title === '' ? 'Untitled note' : title);

  return (
    <article className="note-detail">
      <div className="note-detail__scroll">
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
            <p className="note-detail__muted">
              This note doesn&apos;t exist, or it isn&apos;t available to you.
            </p>
            <Link to="/notes">Back to your notes</Link>
          </div>
        ) : null}

        {state.status === 'ready' ? (
          <NoteEditorHost key={state.row.localId} row={state.row} currentUserId={currentUserId} />
        ) : null}

        {/*
          No InlineVoiceNotes accessory and no <VoiceRecorder> here, unlike
          NoteDetailPage. Both are keyed to a serverId — voice notes are
          uploads/grants against the SERVER's note row — and a note still on
          this route has none yet. As soon as NoteEditorHost's replaceState
          effect fires, the URL becomes /notes/:serverId and NoteDetailPage
          (which has both) takes over the same editor instance.
        */}
      </div>
    </article>
  );
}
