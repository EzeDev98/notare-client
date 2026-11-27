/** A note that has not reached the server yet. */
import { Link, useParams } from 'react-router';

import { NoteEditorHost } from '@/features/editor/components/NoteEditorHost';
import { useLocalNote } from '@/features/notes/hooks/useLocalNote';
import { deriveNoteLabel } from '@/features/notes/local/noteLabel';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './NoteDetail.css';
import { ROUTES } from '@/app/routes';

export function LocalNoteDetailPage() {
  const { localId } = useParams();
  const state = useLocalNote(localId);

  const label =
    state.status === 'ready' ? deriveNoteLabel(state.row.content, state.row.aiTitle).label : null;
  useDocumentTitle(label ?? 'Note');

  return (
    <article className="note-detail">
      <div className="note-detail__scroll">
        {state.status === 'not-found' ? (
          <div className="note-detail__centre">
            <h1>Note not found</h1>
            <p className="note-detail__muted">
              This note doesn&apos;t exist, or it isn&apos;t available to you.
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
