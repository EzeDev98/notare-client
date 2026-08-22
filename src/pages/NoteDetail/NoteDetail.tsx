import { Link, useParams } from 'react-router';

import { useAuth } from '@/app/providers/auth-context';
import { NoteEditorHost } from '@/features/editor/components/NoteEditorHost';
import { InlineVoiceNotes } from '@/features/voice/components/InlineVoiceNote/InlineVoiceNote';
import { parseNoteId, useNote } from '@/features/notes/hooks/useNote';
import { deriveNoteLabel } from '@/features/notes/local/noteLabel';
import { VoiceRecorder, type VoiceUploadHandle } from '@/features/voice/components/VoiceRecorder/VoiceRecorder';
import { useUploadVoiceNote } from '@/features/voice/hooks/useVoiceNoteMutations';
import { useVoiceNotesByNote } from '@/features/voice/hooks/useVoiceNotes';
import { Spinner } from '@/design-system/components/Spinner/Spinner';
import { useDelayedFlag } from '@/shared/hooks/useDelayedFlag';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './NoteDetail.css';

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
const LOADING_SPINNER_DELAY_MS = 150;

export function NoteDetailPage() {
  const { noteId: noteIdParam } = useParams();
  const serverId = parseNoteId(noteIdParam);

  const state = useNote(serverId);
  const showLoadingSpinner = useDelayedFlag(
    state.status === 'loading',
    LOADING_SPINNER_DELAY_MS,
  );
  const { state: authState } = useAuth();
  const currentUserId =
    authState.status === 'authenticated' || authState.status === 'refreshing'
      ? authState.user.id
      : null;

  const voiceNotes = useVoiceNotesByNote(serverId);
  const uploadMutation = useUploadVoiceNote();
  /**
   * Adapts `useUploadVoiceNote` (whose variables carry an OPTIONAL noteId,
   * since it also backs the standalone `/voice` recorder with no note at
   * all) to `VoiceRecorder`'s fixed-note `VoiceUploadHandle` shape, closing
   * over this page's own `serverId`. Rebuilt each render — no useMemo —
   * since nothing here depends on this object's referential identity across
   * renders; only VoiceRecorder's own click handlers close over it.
   */
  const upload: VoiceUploadHandle = {
    mutate: (variables, options) =>
      uploadMutation.mutate(
        { ...variables, ...(serverId !== null ? { noteId: serverId } : {}) },
        options,
      ),
    isPending: uploadMutation.isPending,
    isError: uploadMutation.isError,
  };

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
        {/*
          Just the back link now — no inline "Share" link here anymore.
          Sharing moved to the toolbar's Share icon (AppLayout.tsx), which
          acts on whichever note is currently open via a route match, so
          there is exactly one Share entry point instead of two.
        */}
        <nav className="note-detail__back">
          <Link to="/notes">← All notes</Link>
        </nav>

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
          <div className="note-detail__editor-region">
            <NoteEditorHost
              row={state.row}
              currentUserId={currentUserId}
              contentAccessory={
                voiceNotes.data && voiceNotes.data.length > 0 ? (
                  <InlineVoiceNotes voiceNotes={voiceNotes.data} />
                ) : null
              }
            />
          </div>
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
        <VoiceRecorder upload={upload} noteId={state.row.serverId} />
      ) : null}
    </article>
  );
}