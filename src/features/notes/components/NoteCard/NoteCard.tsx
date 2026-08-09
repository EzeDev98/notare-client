import { Link } from 'react-router';

import type { NoteSummaryResponse } from '@/features/notes/types';
import { Button } from '@/design-system/components/Button/Button';
import { formatServerDateTimeAbsolute, formatServerDateTimeRelative } from '@/lib/time';
import './NoteCard.css';

interface NoteCardProps {
  note: NoteSummaryResponse;
  onDelete: (noteId: number, title: string | null) => void;
  onTogglePin: (note: NoteSummaryResponse) => void;
  /** Archive, or unarchive when already archived. */
  onToggleArchive: (note: NoteSummaryResponse) => void;
}

/**
 * One note in the list.
 *
 * STRUCTURE MATTERS HERE. A <button> inside an <a> is invalid — interactive
 * content nested in interactive content. Browsers recover differently,
 * keyboard behaviour is unpredictable, and screen readers announce something
 * confusing.
 *
 * So the link and the button are SIBLINGS. The link is stretched over the card
 * with a positioned ::after (see the CSS), and the button sits above it in the
 * stacking order. Same visual result, valid structure, and both are ordinary
 * focusable elements.
 */
export function NoteCard({ note, onDelete, onTogglePin, onToggleArchive }: NoteCardProps) {
  // The server allows a null title; a note with neither is still a real note.
  const title = note.title?.trim() ?? '';

  return (
    <li className="note-card">
      <Link className="note-card__link" to={`/notes/${String(note.id)}`}>
        <h2 className="note-card__title">
          {title === '' ? <span className="note-card__untitled">Untitled</span> : title}
        </h2>

        {note.contentPreview !== null && note.contentPreview.trim() !== '' ? (
          <p className="note-card__preview">{note.contentPreview}</p>
        ) : null}

        <p className="note-card__meta">
          {note.pinned ? <span className="note-card__badge">Pinned</span> : null}
          <time dateTime={note.updatedAt} title={formatServerDateTimeAbsolute(note.updatedAt)}>
            {formatServerDateTimeRelative(note.updatedAt)}
          </time>
        </p>
      </Link>

      <div className="note-card__actions">
        {/* Every action names the note. Twenty buttons announcing "Pin" is
            useless when navigating by button. */}
        <Button
          variant="ghost"
          size="sm"
          aria-label={`${note.pinned ? 'Unpin' : 'Pin'} ${title === '' ? 'untitled note' : title}`}
          onClick={() => {
            onTogglePin(note);
          }}
        >
          <span aria-hidden="true">{note.pinned ? 'Unpin' : 'Pin'}</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          aria-label={`${note.archived ? 'Unarchive' : 'Archive'} ${title === '' ? 'untitled note' : title}`}
          onClick={() => {
            onToggleArchive(note);
          }}
        >
          <span aria-hidden="true">{note.archived ? 'Unarchive' : 'Archive'}</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          /*
           * The accessible name says WHICH note. Twenty buttons all announcing
           * "Delete" is useless when navigating by button — a screen reader
           * user hears the same word twenty times with no way to tell them
           * apart.
           */
          aria-label={`Move ${title === '' ? 'untitled note' : title} to trash`}
          onClick={() => {
            onDelete(note.id, note.title);
          }}
        >
          <span aria-hidden="true">Delete</span>
        </Button>
      </div>
    </li>
  );
}
