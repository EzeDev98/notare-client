import { useState } from 'react';
import { Link } from 'react-router';

import { Button } from '@/design-system/components/Button/Button';
import { Modal } from '@/design-system/components/Modal/Modal';
import { NotebookPen } from 'lucide-react';
import type { NoteView } from '@/features/notes/local/noteMappers';
import { deriveNoteLabel } from '@/features/notes/local/noteLabel';
import { formatServerDateTimeAbsolute, formatServerDateTimeRelative } from '@/lib/time';
import { useLongPressContextMenu } from '@/shared/hooks/useLongPressContextMenu';
import './NoteCard.css';

export interface NoteCardActions {
  onTogglePin: (note: NoteView) => void;
  onToggleArchive: (note: NoteView) => void;
  onDelete: (note: NoteView) => void;
}

interface NoteCardProps {
  note: NoteView;
  /**
   * Omitted where the row is not ours to mutate — search results, for now.
   *
   * OPTIONAL rather than three no-op callbacks: passing `() => undefined`
   * renders buttons that silently do nothing, which is worse than not
   * rendering them. Absence of the prop is absence of the affordance.
   */
  actions?: NoteCardActions;
  /**
   * Raised on right-click, a two-finger click on a Mac trackpad (both via
   * the native `contextmenu` event), and a touch-and-hold long press (via
   * `useLongPressContextMenu`'s own timer — see that hook's doc comment for
   * why a long press needs its own path rather than riding the native
   * event, same as `SidebarNoteItem`'s copy of this same prop). Optional
   * for the same reason `actions` is: a page with nothing to do about the
   * menu (e.g. a future read-only list) simply omits it and gets no
   * long-press affordance rather than a menu with no working items.
   */
  onContextMenu?: (note: NoteView, x: number, y: number) => void;
  /** True while THIS card's own context menu is open — a visual echo of the
   * menu's presence, since the menu itself renders wherever the page that
   * owns this list puts it, not as this card's child. */
  isMenuOpen?: boolean;
}

/**
 * One note in the list.
 *
 * Takes a NoteView — a row as the UI wants it — rather than a wire type. The
 * difference that matters: `serverId` may be null for a note created offline,
 * and routing uses `localId`, which exists from the moment the note does.
 */
export function NoteCard({ note, actions, onContextMenu, isMenuOpen = false }: NoteCardProps) {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  /*
   * 1C: the note's first line of content IS the label now — there is no
   * title field. `remainder` (everything after that line) feeds the
   * preview below instead of the raw content, so the heading and its own
   * preview don't just repeat each other.
   */
  const { label, remainder } = deriveNoteLabel(note.content);

  // Always called (rules of hooks) — the `onOpen` callback itself no-ops
  // when `onContextMenu` was never passed, and the handlers below are only
  // spread onto the card when it was, so a page that opted out (Search
  // results, today) gets neither the native-event suppression nor the
  // long-press timer running for nothing.
  const longPress = useLongPressContextMenu((x, y) => {
    onContextMenu?.(note, x, y);
  });

  return (
    <li
      data-note-card-id={note.localId}
      className={['note-card', isMenuOpen ? 'note-card--menu-open' : ''].filter(Boolean).join(' ')}
      {...(onContextMenu ? longPress : {})}
    >
      <Link
        className="note-card__link"
        // localId, not serverId: an offline-created note has no server id and
        // still needs to be openable.
        to={
          note.serverId === null
            ? `/notes/local/${note.localId}`
            : `/notes/${String(note.serverId)}`
        }
      >
        <h2 className="note-card__title">{label}</h2>

        {remainder !== '' ? <p className="note-card__preview">{remainder.slice(0, 200)}</p> : null}

        <p className="note-card__meta">
          {note.pinned ? <span className="note-card__badge">Pinned</span> : null}
          {/* Text, not just an icon — a note with unsent changes is worth
              saying plainly (§36). */}
          {note.unsaved ? <span className="note-card__badge">Unsaved</span> : null}
          {note.updatedAt !== null ? (
            <time dateTime={note.updatedAt} title={formatServerDateTimeAbsolute(note.updatedAt)}>
              {formatServerDateTimeRelative(note.updatedAt)}
            </time>
          ) : (
            <span>Not saved yet</span>
          )}
        </p>
      </Link>

      {/*
        OUTSIDE the Link, not inside it. A <button> nested in an <a> is invalid
        HTML, and browsers recover from it unpredictably — the click may
        navigate instead of firing the handler. The card is a link; the actions
        sit beside it.

        Every label names the note. A screen-reader user tabbing a list of
        twenty notes otherwise hears "Pin, Archive, Delete" twenty times with
        nothing distinguishing them (§36).
      */}
      {actions ? (
        <div className="note-card__actions">
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={note.pinned}
            aria-label={note.pinned ? `Unpin ${label}` : `Pin ${label}`}
            onClick={() => {
              actions.onTogglePin(note);
            }}
          >
            {note.pinned ? 'Unpin' : 'Pin'}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            aria-label={note.archived ? `Unarchive ${label}` : `Archive ${label}`}
            onClick={() => {
              actions.onToggleArchive(note);
            }}
          >
            {note.archived ? 'Unarchive' : 'Archive'}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            aria-label={`Delete ${label}`}
            onClick={() => {
              setDeleteModalOpen(true);
            }}
          >
            Delete
          </Button>
        </div>
      ) : null}

      {deleteModalOpen ? (
        <Modal
          icon={<NotebookPen aria-hidden="true" />}
          description="Delete this note? The note will be moved to Trash."
          secondaryAction={{
            label: 'Cancel',
            onClick: () => {
              setDeleteModalOpen(false);
            },
          }}
          primaryAction={{
            label: 'Delete',
            onClick: () => {
              setDeleteModalOpen(false);
              actions?.onDelete(note);
            },
          }}
          onClose={() => {
            setDeleteModalOpen(false);
          }}
        />
      ) : null}
    </li>
  );
}