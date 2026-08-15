import { NavLink } from 'react-router';

import type { NoteView } from '@/features/notes/local/noteMappers';
import './SidebarNoteItem.css';

interface SidebarNoteItemProps {
  note: NoteView;
}

/**
 * One row in the desktop sidebar's live note list (AppLayout.tsx,
 * ≥1024px only). Deliberately NOT `NoteCard` — that component carries a
 * title, a content preview, pin/archive/delete actions and meta text,
 * sized for a full-width list in the main content area. A 240px rail has
 * room for a title and nothing else; reusing NoteCard here would either
 * overflow or need every one of its parts fought back down to fit,
 * which is a rebuild wearing NoteCard's name. `/notes` (NotesPage) is
 * unchanged and still exactly where those actions live.
 *
 * `NavLink`, not `Link` — the same `aria-current="page"` + CSS-attribute
 * pattern `AppLayout.css`'s own `.app-shell__nav-link[aria-current='page']`
 * already uses, so the open note highlights in the list for free, with
 * no separate "which note is active" state to keep in sync by hand.
 */
export function SidebarNoteItem({ note }: SidebarNoteItemProps) {
  const title = note.title.trim();
  const label = title === '' ? 'Untitled' : title;

  // localId, not serverId: an offline-created note has no server id yet
  // and still needs to be openable — same routing NoteCard already uses.
  const to =
    note.serverId === null ? `/notes/local/${note.localId}` : `/notes/${String(note.serverId)}`;

  return (
    <li className="sidebar-note-item">
      <NavLink to={to} className="sidebar-note-item__link">
        {title === '' ? (
          <span className="sidebar-note-item__untitled">{label}</span>
        ) : (
          label
        )}
      </NavLink>
    </li>
  );
}
