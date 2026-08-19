import { Mic } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { EditorSurface } from '@/features/editor/components/EditorSurface/EditorSurface';
import { SharedAudioPlayer } from '@/features/sharedVoiceNotes/components/SharedAudioPlayer/SharedAudioPlayer';
import { isNoGrantError, useSharedVoiceNote } from '@/features/sharedVoiceNotes/hooks/useSharedVoiceNote';
import { formatUserName, useUserLookup } from '@/features/userLookup/hooks/useUserLookup';
import { parseVoiceNoteId } from '@/pages/VoiceDetail/VoiceDetail';
import { formatServerDateTimeAbsolute, formatServerDateTimeRelative } from '@/lib/time';
import { Spinner } from '@/design-system/components/Spinner/Spinner';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';

// Reuses `/shared/:id`'s stylesheet on purpose — see the doc comment below.
import '@/pages/SharedNote/SharedNote.css';

/**
 * `/shared-voice/:id` — a standalone shared voice note's destination.
 *
 * DIFFERENT ROUTE FROM `/shared/:id` ON PURPOSE: the two live in different
 * id spaces server-side (a voice note is not a kind of note), and a
 * standalone voice share genuinely has no note behind it to open. Collapsing
 * the routes would mean inventing a note id that doesn't exist.
 *
 * SAME INTERFACE AS `/shared/:id` ON PURPOSE, unlike the route split above.
 * The note is the parent container in this product: whether what was shared
 * is a text note, a note with attached recordings, or "just" a voice note,
 * opening it should look like opening a note. This page reuses
 * `SharedNote.css` and `EditorSurface` (in `hideBody` mode, since there is
 * no text body to show) so the title, back-link, and "Shared by X · time"
 * status line all read identically to `/shared/:id` rather than a bespoke
 * `.shared-voice-detail__*` layout.
 *
 * A voice grant is READ-only in practice today (the grant-gated audio
 * endpoints only ever check for READ), so there is no recorder here, no
 * WRITE-mode editing, and no conflict handling — nothing invented beyond
 * what the underlying model actually supports.
 *
 * The dedicated `/voice/:id` transcription workflow remains an OWNER
 * capability. A recipient here does not own the recording, so no transcribe
 * link is offered.
 */
export function SharedVoiceDetailPage() {
  const { voiceNoteId: param } = useParams();
  const voiceNoteId = parseVoiceNoteId(param);

  const query = useSharedVoiceNote(voiceNoteId ?? -1);

  const filename = (query.data?.originalFilename ?? '').trim();
  useDocumentTitle(filename === '' ? 'Shared voice note' : filename);

  // One-id batch lookup — same `useUserLookup` feature every other
  // owner-name consumer on this page's siblings uses, not a bespoke fetch.
  const ownerIds = query.data ? [query.data.ownerId] : [];
  const { profiles, isLoading: ownerNameLoading } = useUserLookup(ownerIds);
  const ownerName =
    query.data && !ownerNameLoading
      ? formatUserName(profiles.get(query.data.ownerId))
      : undefined;

  if (voiceNoteId === null) {
    return (
      <article className="shared-note">
        <SharedVoiceDetailChrome />

        <div className="shared-note__centre">
          <h1>Voice note not found</h1>
          <Link to="/shared">Back to shared with me</Link>
        </div>
      </article>
    );
  }

  return (
    <article className="shared-note">
      <SharedVoiceDetailChrome />

      {query.isLoading ? (
        <div className="shared-note__centre">
          <Spinner label="Loading this recording" />
        </div>
      ) : null}

      {query.isError && isNoGrantError(query.error) ? (
        <div className="shared-note__centre">
          <h1>Not shared with you</h1>

          {/*
            Deliberately vague about WHY, same reasoning as `SharedNote.tsx`'s
            identical copy: this 404 also covers a voice note that never
            existed, so naming a specific cause would be a claim the
            response doesn't actually support.
          */}
          <p className="shared-note__muted">
            This recording isn&apos;t available to you — it may have never
            been shared with you, or access may have changed.
          </p>

          <Link to="/shared">Back to shared with me</Link>
        </div>
      ) : null}

      {query.isError && !isNoGrantError(query.error) ? (
        <div className="shared-note__centre" role="alert">
          <h1>Can&apos;t open this recording</h1>

          <p className="shared-note__muted">
            You&apos;re offline, or Notare can&apos;t be reached right now.
          </p>

          <button
            type="button"
            className="shared-note__retry"
            onClick={() => void query.refetch()}
          >
            Try again
          </button>
        </div>
      ) : null}

      {query.data ? (
        <>
          <div className="shared-note__mode" role="status">
            <span>
              {ownerName !== undefined ? <>Shared by {ownerName} &middot; </> : 'Shared '}
              <time
                dateTime={query.data.sharedAt}
                title={formatServerDateTimeAbsolute(query.data.sharedAt)}
              >
                {formatServerDateTimeRelative(query.data.sharedAt)}
              </time>
              {' · '}
              {query.data.permission === 'WRITE' ? 'Can edit' : 'Read only'}
            </span>
          </div>

          {/*
            `hideBody`: there is no text content behind a standalone voice
            share, so the note surface stops at the title — same title
            styling and placeholder behaviour as `/shared/:id`, just without
            reserving the editor's 60vh body for an empty, read-only field.
          */}
          <EditorSurface
            title={filename === '' ? 'Voice note' : filename}
            content=""
            onTitleChange={() => {
              /* Voice shares are read-only; the title field never accepts edits. */
            }}
            onContentChange={() => {
              /* No body to edit in a voice-only share. */
            }}
            readOnly
            hideBody
          />

          <div className="shared-note__voice-card">
            <span className="shared-note__voice-icon" aria-hidden="true">
              <Mic size={18} />
            </span>

            <div className="shared-note__voice-player">
              <SharedAudioPlayer voiceNoteId={voiceNoteId} />
            </div>
          </div>
        </>
      ) : null}
    </article>
  );
}

function SharedVoiceDetailChrome() {
  return (
    <nav className="shared-note__back">
      <Link to="/shared">← Shared with me</Link>
    </nav>
  );
}
