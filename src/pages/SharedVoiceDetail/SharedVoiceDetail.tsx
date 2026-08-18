import { Link, useParams } from 'react-router';

import { SharedAudioPlayer } from '@/features/sharedVoiceNotes/components/SharedAudioPlayer/SharedAudioPlayer';
import { isNoGrantError, useSharedVoiceNote } from '@/features/sharedVoiceNotes/hooks/useSharedVoiceNote';
import { formatUserName, useUserLookup } from '@/features/userLookup/hooks/useUserLookup';
import { parseVoiceNoteId } from '@/pages/VoiceDetail/VoiceDetail';
import { formatServerDateTimeAbsolute, formatServerDateTimeRelative } from '@/lib/time';
import { Spinner } from '@/design-system/components/Spinner/Spinner';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './SharedVoiceDetail.css';

/**
 * `/shared-voice/:id` — a shared voice note's playable destination. The
 * voice-note counterpart to `SharedNote.tsx` (`/shared/:id`), and what
 * `SharedVoiceNoteCard` (10d) links to from "Shared with me"'s Voice tab.
 *
 * A DIFFERENT ROUTE FROM `/voice/:id` ON PURPOSE, not a shared component
 * branching on a prop — the identical reasoning `SharedNote.tsx`'s own doc
 * comment gives for staying separate from `NoteDetail`: this page has no
 * delete affordance, no transcript panel (the recipient endpoints this
 * page reads — `GET /shared-voice-notes/{id}` — carry no transcript field
 * at all, unlike the owner-side `TranscriptionPanel`'s own endpoint), and
 * cannot gain either by accident the way a shared component's unused prop
 * paths can silently start being relied on.
 *
 * MUCH SIMPLER than `SharedNote.tsx`: a voice grant is READ-only in
 * practice today (`SharedVoiceNoteCard`'s own doc comment — the grant-
 * gated audio endpoints only ever check for READ), so there is no
 * WRITE-mode editor, no `useSharedNotePermission`-style cache lookup, no
 * conflict handling to build. The permission badge below still reflects
 * whatever the server actually returns rather than assuming READ, so nothing
 * here would misrepresent a future WRITE grant — it simply has no extra
 * capability to offer one today, per this project's standing rule against
 * inventing capabilities the underlying model doesn't support.
 */
export function SharedVoiceDetailPage() {
  const { voiceNoteId: param } = useParams();
  const voiceNoteId = parseVoiceNoteId(param);

  const query = useSharedVoiceNote(voiceNoteId ?? -1);

  const filename = (query.data?.originalFilename ?? '').trim();
  useDocumentTitle(filename === '' ? 'Shared voice note' : filename);

  // One-id batch lookup — same `useUserLookup` feature every other owner-
  // name consumer on this page's siblings uses, not a bespoke fetch.
  const ownerIds = query.data ? [query.data.ownerId] : [];
  const { profiles, isLoading: ownerNameLoading } = useUserLookup(ownerIds);
  const ownerName =
    query.data && !ownerNameLoading ? formatUserName(profiles.get(query.data.ownerId)) : undefined;

  if (voiceNoteId === null) {
    return (
      <section className="shared-voice-detail">
        <SharedVoiceDetailChrome />
        <div className="shared-voice-detail__centre">
          <h1>Voice note not found</h1>
          <Link to="/shared">Back to shared with me</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="shared-voice-detail">
      <SharedVoiceDetailChrome />

      {query.isLoading ? (
        <div className="shared-voice-detail__centre">
          <Spinner label="Loading this recording" />
        </div>
      ) : null}

      {query.isError && isNoGrantError(query.error) ? (
        <div className="shared-voice-detail__centre">
          <h1>Not shared with you</h1>
          {/*
            Deliberately vague about WHY, same reasoning as
            `SharedNote.tsx`'s identical copy: this 404 also covers a voice
            note that never existed, so naming a specific cause would be a
            claim the response doesn't actually support.
          */}
          <p className="shared-voice-detail__muted">
            This recording isn&apos;t available to you — it may have never been shared with
            you, or access may have changed.
          </p>
          <Link to="/shared">Back to shared with me</Link>
        </div>
      ) : null}

      {query.isError && !isNoGrantError(query.error) ? (
        <div className="shared-voice-detail__centre" role="alert">
          <h1>Can&apos;t open this recording</h1>
          <p className="shared-voice-detail__muted">
            You&apos;re offline, or Notare can&apos;t be reached right now.
          </p>
          <button
            type="button"
            className="shared-voice-detail__retry"
            onClick={() => void query.refetch()}
          >
            Try again
          </button>
        </div>
      ) : null}

      {query.data ? (
        <>
          <header className="shared-voice-detail__header">
            <h1>
              {filename === '' ? (
                <span className="shared-voice-detail__untitled">Voice note</span>
              ) : (
                filename
              )}
            </h1>
            <span
              className="shared-voice-detail__badge"
              data-permission={query.data.permission}
            >
              {query.data.permission === 'WRITE' ? 'Can edit' : 'Read only'}
            </span>
          </header>

          <p className="shared-voice-detail__muted">
            {ownerName !== undefined ? <>Shared by {ownerName} &middot; </> : 'Shared '}
            <time
              dateTime={query.data.sharedAt}
              title={formatServerDateTimeAbsolute(query.data.sharedAt)}
            >
              {formatServerDateTimeRelative(query.data.sharedAt)}
            </time>
          </p>

          <div className="shared-voice-detail__player">
            <SharedAudioPlayer voiceNoteId={voiceNoteId} />
          </div>
        </>
      ) : null}
    </section>
  );
}

function SharedVoiceDetailChrome() {
  return (
    <nav className="shared-voice-detail__back">
      <Link to="/shared">← Shared with me</Link>
    </nav>
  );
}
