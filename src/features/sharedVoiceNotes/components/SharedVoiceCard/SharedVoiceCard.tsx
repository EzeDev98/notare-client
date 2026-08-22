import { Link } from 'react-router';

import type { SharedVoiceNoteSummaryResponse } from '@/features/sharedVoiceNotes/types';
import { formatServerDateTimeAbsolute, formatServerDateTimeRelative } from '@/lib/time';
import './SharedVoiceCard.css';

interface SharedVoiceCardProps {
  shared: SharedVoiceNoteSummaryResponse;
  /**
   * The owner's display name, already resolved and formatted — same
   * page-level batch `useUserLookup` contract as `SharedNoteCard.ownerName`.
   * `undefined` means "still resolving"; see that component's own doc
   * comment for why that state renders nothing rather than a placeholder.
   */
  ownerName?: string | undefined;
}

/**
 * One row on "Shared with me" for a STANDALONE shared voice note (`noteId
 * === null`). Deliberately styled as a note-shaped card — same
 * `.shared-note-card`-derived look as `SharedNoteCard` — per the brief:
 * "Note has always been the parent... a voice note attached to an existing
 * note does not create a second list item" — a standalone voice share is
 * presented as a note-like item too, just with a recording in place of a
 * text preview, never as a visually distinct "voice item" type.
 *
 * A voice note with a non-null `noteId` must never reach this component —
 * see the filtering in `SharedNotesPage`. This component doesn't re-check
 * that itself; it trusts its caller, same as `SharedNoteCard` trusts being
 * handed only note shares.
 */
export function SharedVoiceCard({ shared, ownerName }: SharedVoiceCardProps) {
  /*
   * NOT a note title — the note domain has none (1B). This is the
   * recording's own filename (`VoiceNote.originalFilename`); whether that
   * mechanism survives at all is Step 9E's decision, not this one's — kept
   * exactly as it was, just renamed so nothing here reads as a title.
   */
  const filename = (shared.originalFilename ?? '').trim();

  return (
    <li className="shared-note-card shared-voice-card">
      <Link className="shared-note-card__link" to={`/shared-voice/${String(shared.voiceNoteId)}`}>
        <h2 className="shared-note-card__title">
          {filename === '' ? (
            <span className="shared-note-card__untitled">Voice note</span>
          ) : (
            filename
          )}
        </h2>

        <p className="shared-note-card__preview shared-voice-card__preview">
          <span className="shared-voice-card__icon" aria-hidden="true">
            🎙
          </span>
          {formatDuration(shared.durationSeconds)}
        </p>

        <p className="shared-note-card__meta">
          <span className="shared-note-card__badge" data-permission={shared.permission}>
            {shared.permission === 'WRITE' ? 'Can edit' : 'Read only'}
          </span>
          <span className="shared-note-card__owner-time">
            {ownerName !== undefined ? <>Shared by {ownerName} &middot; </> : 'Shared '}
            <time
              dateTime={shared.sharedAt}
              title={formatServerDateTimeAbsolute(shared.sharedAt)}
            >
              {formatServerDateTimeRelative(shared.sharedAt)}
            </time>
          </span>
        </p>
      </Link>
    </li>
  );
}

function formatDuration(durationSeconds: number | null): string {
  if (durationSeconds === null) return 'Voice recording';
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  return `${String(minutes)}:${String(seconds).padStart(2, '0')}`;
}
