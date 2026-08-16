import { NavLink } from 'react-router';

import type { NoteView } from '@/features/notes/local/noteMappers';
import { formatServerDateTimeAbsolute, formatServerDateTimeRelative } from '@/lib/time';
import './SidebarNoteItem.css';

interface SidebarNoteItemProps {
  note: NoteView;
}

/**
 * One row in the desktop sidebar's live note list (AppLayout.tsx,
 * ≥1024px only). Deliberately NOT `NoteCard` — that component carries
 * pin/archive/delete actions sized for a full-width list in the main
 * content area, where a 240px rail only has room for a title and a
 * one-line preview.
 *
 * `NavLink`, not `Link` — the same `aria-current="page"` + CSS-attribute
 * pattern `AppLayout.css`'s own `.app-shell__nav-link[aria-current='page']`
 * already uses, so the open note highlights in the list for free, with
 * no separate "which note is active" state to keep in sync by hand.
 *
 * TITLE AND PREVIEW, the reference app's own convention: a note with no
 * explicit title borrows its first non-blank line as the title (so a note
 * is never labelled by a blank field the person never filled in), and the
 * second line previews whatever text follows it. A note that is entirely
 * empty — no title, no content — reads as "New Note" / "No additional
 * text", never "Untitled": nothing has been left blank so much as not yet
 * written.
 */
export function SidebarNoteItem({ note }: SidebarNoteItemProps) {
  const titleTrimmed = note.title.trim();
  const contentTrimmed = note.content.trim();
  const lines = contentTrimmed.split('\n');
  const firstLineIndex = lines.findIndex((line) => line.trim() !== '');
  const firstLine = firstLineIndex === -1 ? '' : (lines[firstLineIndex] ?? '').trim();

  const displayTitle =
    titleTrimmed !== '' ? titleTrimmed : firstLine !== '' ? firstLine : 'New Note';

  // An explicit title leaves the WHOLE content free to preview. Without
  // one, the first line has already been borrowed as the title above, so
  // the preview picks up from the line after it — otherwise the title and
  // its own preview would just repeat each other.
  const remainder =
    titleTrimmed === '' && firstLineIndex !== -1
      ? lines.slice(firstLineIndex + 1).join(' ')
      : contentTrimmed;
  const previewText = remainder.replace(/\s+/g, ' ').trim();
  const preview = previewText === '' ? 'No additional text' : previewText.slice(0, 80);

  const dateLabel =
    note.updatedAt !== null ? formatServerDateTimeRelative(note.updatedAt) : 'Not saved yet';

  // localId, not serverId: an offline-created note has no server id yet
  // and still needs to be openable — same routing NoteCard already uses.
  const to =
    note.serverId === null ? `/notes/local/${note.localId}` : `/notes/${String(note.serverId)}`;

  return (
    <li className="sidebar-note-item">
      <NavLink to={to} className="sidebar-note-item__link">
        <span className="sidebar-note-item__title">{displayTitle}</span>
        <span className="sidebar-note-item__meta">
          <span className="sidebar-note-item__date">
            {note.updatedAt !== null ? (
              <time
                dateTime={note.updatedAt}
                title={formatServerDateTimeAbsolute(note.updatedAt)}
              >
                {dateLabel}
              </time>
            ) : (
              dateLabel
            )}
          </span>
          <span className="sidebar-note-item__preview">{preview}</span>
        </span>
      </NavLink>
    </li>
  );
}
