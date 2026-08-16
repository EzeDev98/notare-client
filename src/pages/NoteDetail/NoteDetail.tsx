import { Link, useParams } from 'react-router';

import { useAuth } from '@/app/providers/auth-context';
import { NoteEditorHost } from '@/features/editor/components/NoteEditorHost';
import { parseNoteId, useNote } from '@/features/notes/hooks/useNote';
import { VoiceNoteCard } from '@/features/voice/components/VoiceNoteCard/VoiceNoteCard';
import { VoiceRecorder } from '@/features/voice/components/VoiceRecorder/VoiceRecorder';
import { useVoiceNotesByNote } from '@/features/voice/hooks/useVoiceNotes';
import { useDeleteVoiceNote } from '@/features/voice/hooks/useVoiceNoteMutations';
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
        loading/error states, and the editor itself. Voice notes sits
        OUTSIDE this div, as a sibling below it, so it stays visible as a
        fixed footer no matter how far the editor content scrolls — the
        exact same structural pattern the sidebar uses for Archived/Trash/
        Voice/Notifications/Account: a flex:1, min-block-size:0,
        overflow-y:auto region for the part that scrolls, and a
        flex-shrink:0 sibling for the part that doesn't.
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
      </div>

      {/*
        serverId, not localId — same reasoning as the Share link above.
        Voice notes link to a NOTE ID the server knows about
        (VoiceNote.noteId), so an unsynced note has nothing for a
        recording to attach to yet. OUTSIDE .note-detail__scroll on
        purpose — see that div's own comment.
      */}
      {state.status === 'ready' && state.row.serverId !== null ? (
        <NoteVoiceSection serverId={state.row.serverId} />
      ) : null}
    </article>
  );
}

/**
 * "Record and transcribe. Record → upload → submit transcription → poll
 * → transcript appears alongside the note." (architecture doc §3's
 * usability scenario 6, verbatim) — this section is that scenario's home.
 * `/voice/:id` (VoiceDetail) remains the durable, linkable destination
 * for one recording; this is the inline, in-context place to make one.
 */
function NoteVoiceSection({ serverId }: { serverId: number }) {
  const voiceNotes = useVoiceNotesByNote(serverId);
  const deleteVoiceNote = useDeleteVoiceNote(serverId);

  return (
    <section className="note-detail__voice" aria-labelledby="note-detail-voice-heading">
      <h2 id="note-detail-voice-heading" className="note-detail__voice-heading">
        Voice notes
      </h2>

      <VoiceRecorder noteId={serverId} />

      {voiceNotes.isLoading ? (
        <div className="note-detail__voice-centre">
          <Spinner label="Loading voice notes" size="sm" />
        </div>
      ) : null}

      {voiceNotes.data && voiceNotes.data.length > 0 ? (
        <ul className="note-detail__voice-list" role="list">
          {voiceNotes.data.map((vn) => (
            <VoiceNoteCard
              key={vn.id}
              voiceNote={vn}
              deleting={deleteVoiceNote.isPending && deleteVoiceNote.variables === vn.id}
              onDelete={(id) => {
                deleteVoiceNote.mutate(id);
              }}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
