import { Link } from 'react-router';

import { deriveNoteLabel } from '@/features/notes/local/noteLabel';
import type { SharedNoteSummaryResponse } from '@/features/sharedNotes/types';
import { formatServerDateTimeAbsolute, formatServerDateTimeRelative } from '@/lib/time';
import './SharedNoteCard.css';

interface SharedNoteCardProps {
  shared: SharedNoteSummaryResponse;
  /**
   * The owner's display name, already resolved and formatted (see
   * `formatUserName`). Resolved via ONE batch `useUserLookup` call at the
   * page level covering every row's `ownerId` at once — never fetched
   * per-card, which is the entire reason that hook batches in the first
   * place (its own doc comment: "in ONE request, however many rows on
   * screen reference those ids").
   *
   * `undefined` means "still resolving", not "no owner" — the page only
   * ever passes a real string once its lookup's `isLoading` is false, at
   * which point `formatUserName`'s own fallback chain (`@username` →
   * "Unknown user") has already run. Rendering nothing while `undefined`
   * avoids a flash of "Unknown user" for a name that's simply still in
   * flight.
   */
  ownerName?: string | undefined;
}

/**
 * One row on "Shared with me" (`/shared` — architecture doc §4.1: "permission
 * badge per row").
 *
 * MIRRORS `NoteCard`'s shape deliberately — same title/preview/meta layout,
 * so the two lists read as the same kind of thing at a glance — but takes
 * `SharedNoteSummaryResponse`, not `NoteView`, and has no `actions` prop at
 * all. `NoteCard.actions` is optional specifically so a card that isn't
 * ours to mutate renders with no affordances; a shared note is NEVER ours
 * to pin, archive, or delete (types.ts's own doc comment, architecture doc
 * §2.4), so there is no optional prop to omit here — the capability simply
 * does not exist on this component.
 *
 * `sharedAt`, not `note.updatedAt` — this list's own fixed sort order
 * (`useSharedNotes.ts`'s doc comment: "there is no sort param to override
 * that") is by share time, and showing a date the list isn't actually
 * ordered by would be misleading.
 */
export function SharedNoteCard({ shared, ownerName }: SharedNoteCardProps) {
  /*
   * 1C/4C: no title field — the note domain has none. The list endpoint
   * only ever sends `contentPreview` (not full content), so the
   * label/remainder split runs on that instead of full content the way
   * NoteCard/SidebarNoteItem get to — `deriveNoteLabel` only needs enough
   * text to find the first line, and a preview is always longer than any
   * real label.
   */
  const { label, remainder } = deriveNoteLabel(shared.note.contentPreview ?? '');

  return (
    <li className="shared-note-card">
      <Link className="shared-note-card__link" to={`/shared/${String(shared.note.id)}`}>
        <h2 className="shared-note-card__title">{label}</h2>

        {remainder !== '' ? (
          <p className="shared-note-card__preview">{remainder.slice(0, 200)}</p>
        ) : null}

        <p className="shared-note-card__meta">
          {/*
            The permission badge itself — this component's whole reason to
            exist as distinct from NoteCard. WRITE is not styled as more
            "important" than READ; it is a capability difference, not a
            status.
          */}
          <span className="shared-note-card__badge" data-permission={shared.permission}>
            {shared.permission === 'WRITE' ? 'Can edit' : 'Read only'}
          </span>
          <span className="shared-note-card__owner-time">
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
