import { Link, useParams } from 'react-router';

import { NoteEditorHost } from '@/features/editor/components/NoteEditorHost';
import { useLocalNote } from '@/features/notes/hooks/useLocalNote';
import { deriveNoteLabel } from '@/features/notes/local/noteLabel';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './NoteDetail.css';
import { ROUTES } from '@/app/routes';

/**
 * A note that has not reached the server yet.
 *
 * Lives at /notes/local/:localId — see NoteCard's routing comment for why a
 * note with serverId === null links here, and the fact that a note
 * stays on this route for its whole editing session: when a serverId is assigned
 * in the background nothing remounts, and the voice recorder appears in place. This page
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

  // 1C/4G: no title field — the note domain has none. Same pattern as
  // NoteDetailPage's document title.
  const label = state.status === 'ready' ? deriveNoteLabel(state.row.content).label : null;
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
