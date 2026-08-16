import { Link, useParams } from 'react-router';

import { useAuth } from '@/app/providers/auth-context';
import { NoteEditorHost } from '@/features/editor/components/NoteEditorHost';
import { parseNoteId, useNote } from '@/features/notes/hooks/useNote';
import { VoiceRecorder } from '@/features/voice/components/VoiceRecorder/VoiceRecorder';
import { useVoiceNotesByNote } from '@/features/voice/hooks/useVoiceNotes';
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
      {/*
        Everything that should SCROLL lives in here — the back link, the
        loading/error states, the editor itself, and the past-recordings
        list. The voice RECORDER (the floating mic/waveform dock) is the
        one thing that sits OUTSIDE this div, as a sibling below it — see
        that element's own comment for why it needs to float rather than
        live in the normal scrolling flow.
      */}
      <div className="note-detail__scroll">
        {/*
          Just the back link now — no inline "Share" link here anymore.
          Sharing moved to the toolbar's Share icon (AppLayout.tsx), which
          acts on whichever note is currently open via a route match, so
          there is exactly one Share entry point instead of two.
        */}
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

        {/*
          serverId, not localId — sharing/voice notes are grants and
          uploads against the SERVER's note row, so a note that has never
          synced has nothing to attach a recording to yet. Inside the
          scroll region now, not a separate footer box — past recordings
          are note content, they scroll with everything else above them.
          Only the RECORDER itself (below) needs to float.
        */}
      </div>

      {/*
        THE floating mic / recording dock — the ONLY thing anchored to
        .note-detail's own box (position:relative there), and the ONLY
        thing outside .note-detail__scroll. Previously this lived INSIDE
        a separate "voice notes" footer section that was ALSO
        flex-shrink:0 with its own background/border/padding — two
        different bottom-anchored things (a real boxed footer, and an
        absolutely-positioned dock inside it) competing for the same
        corner of the screen, which is what made the recording bar look
        broken and overlap the page. Now there is exactly one bottom-right
        element, full stop: it doesn't consume any layout space, so
        nothing else needs to make room for it, and it stays in the exact
        same spot regardless of how far the note content above is
        scrolled — "firm and intact", not shaky.
      */}
      {state.status === 'ready' && state.row.serverId !== null ? (
        <VoiceRecorder noteId={state.row.serverId} />
      ) : null}
    </article>
  );
}
