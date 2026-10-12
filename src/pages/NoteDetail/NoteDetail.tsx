import { Link, useParams } from 'react-router';

import { NoteEditorHost } from '@/features/editor/components/NoteEditorHost';
import { parseNoteId, useNote } from '@/features/notes/hooks/useNote';
import { deriveNoteLabel } from '@/features/notes/local/noteLabel';
import { Spinner } from '@/design-system/components/Spinner/Spinner';
import { useDelayedFlag } from '@/shared/hooks/useDelayedFlag';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './NoteDetail.css';
import { ROUTES } from '@/app/routes';
import { LOADING_SPINNER_DELAY_MS } from '@/core/config/timings';

/*
 * A note switch that lands on this route fresh (local <-> server, or the
 * very first note opened this session) remounts this page — see
 * RouteTransition's own comment on why local and server notes are
 * different route DEFINITIONS even though they're the same editor
 * visually. useNote's Dexie query always takes at least one render tick to
 * answer, even for a note already cached on this device, so a fresh mount
 * always passes through `status: 'loading'` at least once however briefly.
 * For an already-synced note that tick resolves fast enough that showing
 * the spinner immediately just reads as a flash — appear, disappear,
 * nothing gained. Waiting this long before actually revealing it means a
 * fast resolution (the common case) never shows it at all, while a
 * genuinely slow one (offline, never-cached) still does.
 */
// Value: core/config/timings.ts.

export function NoteDetailPage() {
  const { noteId: noteIdParam } = useParams();
  const serverId = parseNoteId(noteIdParam);

  const state = useNote(serverId);
  const showLoadingSpinner = useDelayedFlag(state.status === 'loading', LOADING_SPINNER_DELAY_MS);
  // 1C/4G: no title field — the note domain has none. label is null only
  // while the note hasn't loaded yet; deriveNoteLabel always returns
  // something once ready, so there is no more separate "Untitled" case.
  const label = state.status === 'ready' ? deriveNoteLabel(state.row.content).label : null;
  useDocumentTitle(label ?? 'Note');

  return (
    <article className="note-detail">
      {/*
        Everything that should SCROLL lives in here — the back link, the
        loading/error states, the editor itself, and the past-recordings
        list. The voice RECORDER (the floating mic/waveform dock) is the
        one thing that sits OUTSIDE this div, as a sibling below it — see
        that element's own comment for why it needs to float rather than
        live in the normal scrolling flow.
      */}
      <div className="note-detail__scroll">
        {state.status === 'loading' && showLoadingSpinner ? (
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
            <Link to={ROUTES.notes()}>Back to your notes</Link>
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
