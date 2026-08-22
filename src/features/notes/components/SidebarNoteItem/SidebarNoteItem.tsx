import type { CSSProperties } from 'react';
import { NavLink } from 'react-router';

import type { NoteView } from '@/features/notes/local/noteMappers';
import { deriveNoteLabel, EMPTY_NOTE_REMAINDER } from '@/features/notes/local/noteLabel';
import { formatServerDateTimeAbsolute, formatServerDateTimeRelative } from '@/lib/time';
import './SidebarNoteItem.css';

interface SidebarNoteItemProps {
  note: NoteView;
}

/**
 * One row in the desktop sidebar's live note list (AppLayout.tsx,
 * ≥1024px only). Deliberately NOT `NoteCard` — that component carries
 * pin/archive/delete actions sized for a full-width list in the main
 * content area, where a 240px rail only has room for a label and a
 * one-line preview.
 *
 * `NavLink`, not `Link` — the same `aria-current="page"` + CSS-attribute
 * pattern `AppLayout.css`'s own `.app-shell__nav-link[aria-current='page']`
 * already uses, so the open note highlights in the list for free, with
 * no separate "which note is active" state to keep in sync by hand.
 *
 * LABEL AND PREVIEW (1C): there is no title field any more, so
 * `deriveNoteLabel` (shared with NoteCard) is the ONLY source of what a
 * note is called — this used to be a fallback for a note with no explicit
 * title; now it's unconditional. A note that is entirely empty reads as
 * "New Note" / "No additional text", never "Untitled": nothing has been
 * left blank so much as not yet written.
 */
export function SidebarNoteItem({
  note,
  animationState,
  exitStyle,
}: SidebarNoteItemProps & {
  animationState?: 'enter' | 'exit' | undefined;
  exitStyle?: {
    top: number;
    left: number;
    width: number;
    height: number;
  } | undefined;
}) {
  const { label: displayTitle, remainder } = deriveNoteLabel(note.content);
  const preview = remainder === '' ? EMPTY_NOTE_REMAINDER : remainder.slice(0, 80);

  const dateLabel =
    note.updatedAt !== null ? formatServerDateTimeRelative(note.updatedAt) : 'Not saved yet';

  // localId, not serverId: an offline-created note has no server id yet
  // and still needs to be openable — same routing NoteCard already uses.
  const to =
    note.serverId === null ? `/notes/local/${note.localId}` : `/notes/${String(note.serverId)}`;

  return (
    <li
      data-sidebar-note-id={note.localId}
      style={
        exitStyle
          ? ({
              '--sidebar-note-exit-top': `${exitStyle.top}px`,
              '--sidebar-note-exit-left': `${exitStyle.left}px`,
              '--sidebar-note-exit-width': `${exitStyle.width}px`,
              '--sidebar-note-exit-height': `${exitStyle.height}px`,
            } as CSSProperties)
          : undefined
      }
      className={[
        'sidebar-note-item',
        animationState === 'enter' ? 'sidebar-note-item--enter' : '',
        animationState === 'exit' ? 'sidebar-note-item--exit' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
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
