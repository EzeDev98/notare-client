/** A note opened by its server id. */
import { Link, useParams } from 'react-router';

import { NoteEditorHost } from '@/features/editor/components/NoteEditorHost';
import { parseNoteId, useNote } from '@/features/notes/hooks/useNote';
import { deriveNoteLabel } from '@/features/notes/local/noteLabel';
import { Spinner } from '@/design-system/ui';
import { useDelayedFlag } from '@/shared/hooks/useDelayedFlag';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './NoteDetail.css';
import { ROUTES } from '@/app/routes';
import { LOADING_SPINNER_DELAY_MS } from '@/core/config/timings';

export function NoteDetailPage() {
  const { noteId: noteIdParam } = useParams();
  const serverId = parseNoteId(noteIdParam);

  const state = useNote(serverId);
  const showLoadingSpinner = useDelayedFlag(state.status === 'loading', LOADING_SPINNER_DELAY_MS);
  const label =
    state.status === 'ready' ? deriveNoteLabel(state.row.content, state.row.aiTitle).label : null;
  useDocumentTitle(label ?? 'Note');

  return (
    <article className="note-detail">
      <div className="note-detail__scroll">
        {state.status === 'loading' && showLoadingSpinner ? (
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
            <Link to={ROUTES.notes()}>Back to your notes</Link>
          </div>
        ) : null}

        {state.status === 'unavailable' ? (
          <div className="note-detail__centre" role="alert">
            <h1>Can&apos;t open this note</h1>
            <p className="note-detail__muted">
              You&apos;re offline and this note isn&apos;t saved on this device yet. It will open
              once you&apos;re back online.
            </p>
            <Link to={ROUTES.notes()}>Back to your notes</Link>
          </div>
        ) : null}

        {state.status === 'ready' ? (
          <div className="note-detail__editor-region">
            <NoteEditorHost row={state.row} />
          </div>
        ) : null}
      </div>
    </article>
  );
}
