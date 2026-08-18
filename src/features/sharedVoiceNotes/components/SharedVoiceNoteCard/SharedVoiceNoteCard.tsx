import { Mic } from 'lucide-react';
import { Link } from 'react-router';

import type { SharedVoiceNoteSummaryResponse } from '@/features/sharedVoiceNotes/types';
import { formatServerDateTimeAbsolute, formatServerDateTimeRelative } from '@/lib/time';
import './SharedVoiceNoteCard.css';

interface SharedVoiceNoteCardProps {
  shared: SharedVoiceNoteSummaryResponse;
  /**
   * Resolved once at the Shared with me page level through the single
   * useUserLookup batch request.
   *
   * undefined means the lookup is still in progress.
   */
  ownerName?: string | undefined;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '';

  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;

  return `${String(mins)}:${String(secs).padStart(2, '0')}`;
}

/**
 * A standalone voice note on "Shared with me".
 *
 * This component is only rendered when the voice note does not have a shared
 * parent note available on the current page. Voice notes attached to a shared
 * text note are intentionally suppressed by useSharedItems() and therefore
 * never become duplicate top-level rows.
 *
 * The visual treatment follows the same compact card language as
 * SharedNoteCard: title, supporting metadata, and no owner-side actions.
 *
 * This remains a recipient-specific route. We do not reuse the owner's
 * `/voice/:voiceNoteId` route because shared content has its own
 * authorization boundary.
 */
export function SharedVoiceNoteCard({
  shared,
  ownerName,
}: SharedVoiceNoteCardProps) {
  const filename = (shared.originalFilename ?? '').trim();
  const duration = formatDuration(shared.durationSeconds);

  return (
    <li className="shared-voice-note-card">
      <Link
        className="shared-voice-note-card__link"
        to={`/shared-voice/${String(shared.voiceNoteId)}`}
        aria-label={
          filename === ''
            ? 'Open shared voice note'
            : `Open shared voice note ${filename}`
        }
      >
        <span className="shared-voice-note-card__icon" aria-hidden="true">
          <Mic size={20} />
        </span>

        <span className="shared-voice-note-card__content">
          <h2 className="shared-voice-note-card__title">
            {filename === '' ? (
              <span className="shared-voice-note-card__untitled">
                Voice note
              </span>
            ) : (
              filename
            )}
          </h2>

          <p className="shared-voice-note-card__meta">
            <span className="shared-voice-note-card__owner-time">
              {ownerName !== undefined ? (
                <>
                  Shared by {ownerName} &middot;{' '}
                </>
              ) : (
                'Shared '
              )}

              <time
                dateTime={shared.sharedAt}
                title={formatServerDateTimeAbsolute(shared.sharedAt)}
              >
                {formatServerDateTimeRelative(shared.sharedAt)}
              </time>
            </span>
          </p>
        </span>

        {duration !== '' ? (
          <span className="shared-voice-note-card__duration" aria-label={`Duration ${duration}`}>
            {duration}
          </span>
        ) : null}
      </Link>
    </li>
  );
}
