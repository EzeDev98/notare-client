import { useState } from 'react';
import { Link } from 'react-router';

import { Button } from '@/design-system/components/Button/Button';
import { Modal } from '@/design-system/components/Modal/Modal';
import { Trash2 } from 'lucide-react';
import type { NoteView } from '@/features/notes/local/noteMappers';
import { formatServerDateTimeAbsolute, formatServerDateTimeRelative } from '@/lib/time';
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
}

/**
 * One note in the list.
 *
 * Takes a NoteView — a row as the UI wants it — rather than a wire type. The
 * difference that matters: `serverId` may be null for a note created offline,
 * and routing uses `localId`, which exists from the moment the note does.
 */
export function NoteCard({ note, actions }: NoteCardProps) {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const title = note.title.trim();
  const label = title === '' ? 'Untitled' : title;

  return (
    <li className="note-card">
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
        <h2 className="note-card__title">
          {title === '' ? <span className="note-card__untitled">Untitled</span> : title}
        </h2>

        {note.content.trim() !== '' ? (
          <p className="note-card__preview">{note.content.slice(0, 200)}</p>
        ) : null}

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
          icon={<Trash2 aria-hidden="true" />}
          title="Delete this note?"
          description="The note will be moved to Trash."
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
          destructive
          onClose={() => {
            setDeleteModalOpen(false);
          }}
        />
      ) : null}
    </li>
  );
}
