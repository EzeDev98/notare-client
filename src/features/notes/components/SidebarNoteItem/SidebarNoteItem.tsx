import type { CSSProperties } from 'react';
import { Link } from 'react-router';

import type { NoteView } from '@/features/notes/local/noteMappers';
import { deriveNoteLabel, EMPTY_NOTE_REMAINDER } from '@/features/notes/local/noteLabel';
import {
  formatInstantAbsolute,
  formatInstantRelative,
  formatServerDateTimeAbsolute,
  formatServerDateTimeRelative,
} from '@/lib/time';
import { useLongPressContextMenu } from '@/shared/hooks/useLongPressContextMenu';
import './SidebarNoteItem.css';

interface SidebarNoteItemProps {
  note: NoteView;
  /** Whether THIS row is the currently-open note — computed by the parent
   * list rather than left to route-matching here; see
   * AnimatedSidebarNoteList's own isRowActive comment for why. */
  isActive: boolean;
  /**
   * Raised on right-click, a two-finger click on a Mac trackpad (both via
   * the native `contextmenu` event), and a touch-and-hold long press (via
   * `useLongPressContextMenu`'s own timer — the native event doesn't fire
   * from a long press on plain elements in every browser, iOS Safari
   * chief among them). `x`/`y` are viewport coordinates either way —
   * `NoteContextMenu` is `position: fixed` and wants exactly that.
   */
  onContextMenu: (note: NoteView, x: number, y: number) => void;
  /** True while THIS row's own context menu is open — a visual echo of the
   * menu's presence on the row it belongs to, since the menu itself renders
   * elsewhere in the tree (AppLayout), not as this row's child. */
  isMenuOpen?: boolean;
}

/**
 * One row in the desktop sidebar's live note list (AppLayout.tsx,
 * ≥1024px only). Deliberately NOT `NoteCard` — that component carries
 * pin/archive/delete actions sized for a full-width list in the main
 * content area, where a 240px rail only has room for a label and a
 * one-line preview.
 *
 * Plain `Link`, not `NavLink` — NOT because route-matching is wrong most
 * of the time (it isn't), but because a freshly-created note's own
 * navigate() is deliberately delayed a beat (AppLayout's own
 * NOTE_LIFECYCLE_DELAY_MS comment), so for that window the route still
 * points at whichever note is being pushed down. Route-driven highlighting
 * would keep THAT note's `aria-current="page"` lit while it slides away,
 * instead of the new note sliding in already highlighted. `isActive` is
 * the single source of truth for both — the ordinary case and that
 * pending-creation override — computed once by the parent list rather
 * than recomputed here from a route NavLink can't be told to ignore.
 * `aria-current="page"` is set by hand here so
 * `AppLayout.css`'s own `.sidebar-note-item__link[aria-current='page']`
 * still lights the row up exactly as before.
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
  isActive,
  onContextMenu,
  isMenuOpen = false,
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
  /*
   * A permanent sync failure (server rejected the push — syncState
   * 'invalid') is the one thing worth interrupting this row for. Normal
   * "edited, not yet sent" / "offline, queued" states stay quiet — see
   * NoteView.syncFailed's own doc comment for why.
   */
  const preview = note.syncFailed
    ? 'Sync failed — will retry'
    : remainder === ''
      ? EMPTY_NOTE_REMAINDER
      : remainder.slice(0, 80);

  // No server updatedAt yet is every note's first few seconds of life, not
  // a failure — localUpdatedAt (a real device-clock instant) gives an
  // honest date instead of a "not saved yet" status message.
  const localInstant = new Date(note.localUpdatedAt).toISOString();
  const dateLabel =
    note.updatedAt !== null ? formatServerDateTimeRelative(note.updatedAt) : formatInstantRelative(localInstant);
  const dateTimeAttr = note.updatedAt ?? localInstant;
  const dateTitle =
    note.updatedAt !== null
      ? formatServerDateTimeAbsolute(note.updatedAt)
      : formatInstantAbsolute(localInstant);

  // localId, not serverId: an offline-created note has no server id yet
  // and still needs to be openable — same routing NoteCard already uses.
  const to =
    note.serverId === null ? `/notes/local/${note.localId}` : `/notes/${String(note.serverId)}`;

  // Covers right-click and a two-finger Mac trackpad click via the native
  // `contextmenu` event, AND a touch-and-hold long press via its own timer
  // — see the hook's own doc comment for why touch needs that second path.
  const longPress = useLongPressContextMenu((x, y) => {
    onContextMenu(note, x, y);
  });

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
        isMenuOpen ? 'sidebar-note-item--menu-open' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      {...longPress}
    >
      <Link to={to} className="sidebar-note-item__link" aria-current={isActive ? 'page' : undefined}>
        <span className="sidebar-note-item__title">{displayTitle}</span>
        <span className="sidebar-note-item__meta">
          <span className="sidebar-note-item__date">
            <time dateTime={dateTimeAttr} title={dateTitle}>
              {dateLabel}
            </time>
          </span>
          <span
            className={[
              'sidebar-note-item__preview',
              note.syncFailed ? 'sidebar-note-item__preview--danger' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {preview}
          </span>
        </span>
      </Link>
    </li>
  );
}