import { Link } from 'react-router';

import type { SharedNoteSummaryResponse } from '@/features/sharedNotes/types';
import { formatServerDateTimeAbsolute, formatServerDateTimeRelative } from '@/lib/time';
import './SharedNoteCard.css';

interface SharedNoteCardProps {
  shared: SharedNoteSummaryResponse;
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
export function SharedNoteCard({ shared }: SharedNoteCardProps) {
  /*
   * `.trim()` needs a `string`, not `string | null` — unlike `NoteCard`,
   * which reads `NoteView` (noteMappers.ts already normalises a null server
   * title to `''` on the way into Dexie), this card reads
   * `SharedNoteSummaryResponse` straight off the wire. There is no local
   * row sitting between this component and the raw response to have done
   * that normalising already.
   */
  const title = (shared.note.title ?? '').trim();
  const preview = (shared.note.contentPreview ?? '').trim();

  return (
    <li className="shared-note-card">
      <Link className="shared-note-card__link" to={`/shared/${String(shared.note.id)}`}>
        <h2 className="shared-note-card__title">
          {title === '' ? <span className="shared-note-card__untitled">Untitled</span> : title}
        </h2>

        {preview !== '' ? <p className="shared-note-card__preview">{preview}</p> : null}

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
          <time dateTime={shared.sharedAt} title={formatServerDateTimeAbsolute(shared.sharedAt)}>
            Shared {formatServerDateTimeRelative(shared.sharedAt)}
          </time>
        </p>
      </Link>
    </li>
  );
}
