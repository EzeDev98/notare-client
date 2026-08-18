import { Mic } from 'lucide-react';
import { Link } from 'react-router';

import type { SharedVoiceNoteSummaryResponse } from '@/features/sharedVoiceNotes/types';
import { formatServerDateTimeAbsolute, formatServerDateTimeRelative } from '@/lib/time';

interface SharedVoiceNoteCardProps {
  shared: SharedVoiceNoteSummaryResponse;
  /**
   * Same contract as `SharedNoteCard.ownerName` — resolved via ONE batch
   * `useUserLookup` call at the page level, `undefined` while that lookup
   * is still in flight rather than "no owner". See that prop's own doc
   * comment for the full reasoning; not repeated here.
   */
  ownerName?: string | undefined;
}

/**
 * A duplicate of `VoiceNoteCard.tsx`'s private `formatDuration`, not an
 * import from it. Mirrors this codebase's established rule that
 * recipient-facing content never reuses an owner-side component
 * (`VoiceDetail.tsx` vs `SharedNote.tsx`'s own established pattern) — kept
 * consistent here at the small-helper level too, rather than reaching into
 * `features/voice` for a one-line function and creating a cross-module
 * dependency an owner-side refactor could then break.
 */
function formatDuration(seconds: number | null): string {
  if (seconds === null) return '';
  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins)}:${String(secs).padStart(2, '0')}`;
}

/**
 * One row on "Shared with me"'s Voice view — the voice-note half of the
 * page `SharedNoteCard` already covers for notes.
 *
 * STRUCTURALLY MIRRORS `SharedNoteCard` (same link-wraps-card shape, same
 * "Shared by X · time ago" meta line, same `ownerName` contract) but swaps
 * its permission-badge-plus-preview for an icon plus duration — a
 * deliberate divergence, not an inconsistency:
 *
 *   - NO PREVIEW: a voice note has no text content to excerpt. The `Mic`
 *     icon is the visual anchor `SharedNoteCard`'s title/preview pair would
 *     otherwise occupy.
 *   - NO PERMISSION BADGE: unlike a note grant (READ or WRITE, genuinely
 *     either), a voice grant is READ-only in practice today — the
 *     grant-gated audio endpoints only ever check for READ
 *     (`SharedVoiceNoteSummaryResponse`'s own server-side doc comment). A
 *     badge that always reads the same value isn't conveying anything;
 *     rendering one anyway would imply a WRITE state that can't currently
 *     occur.
 *
 * Links to `/shared-voice/:voiceNoteId` — the recipient's own route,
 * never the owner's `/voice/:voiceNoteId` reused with a permission branch
 * (this project's established pattern, `VoiceDetail.tsx` vs `SharedNote.tsx`).
 */
export function SharedVoiceNoteCard({ shared, ownerName }: SharedVoiceNoteCardProps) {
  const filename = (shared.originalFilename ?? '').trim();

  return (
    <li className="shared-voice-note-card">
      <Link
        className="shared-voice-note-card__link"
        to={`/shared-voice/${String(shared.voiceNoteId)}`}
      >
        <span className="shared-voice-note-card__icon" aria-hidden="true">
          <Mic size={20} />
        </span>

        <h2 className="shared-voice-note-card__title">
          {filename === '' ? (
            <span className="shared-voice-note-card__untitled">Voice note</span>
          ) : (
            filename
          )}
        </h2>

        <span className="shared-voice-note-card__duration">
          {formatDuration(shared.durationSeconds)}
        </span>

        <p className="shared-voice-note-card__meta">
          <span className="shared-voice-note-card__owner-time">
            {ownerName !== undefined ? <>Shared by {ownerName} &middot; </> : 'Shared '}
            <time dateTime={shared.sharedAt} title={formatServerDateTimeAbsolute(shared.sharedAt)}>
              {formatServerDateTimeRelative(shared.sharedAt)}
            </time>
          </span>
        </p>
      </Link>
    </li>
  );
}
