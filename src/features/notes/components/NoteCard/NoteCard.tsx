import { Link } from 'react-router';

import type { NoteView } from '@/features/notes/local/noteMappers';
import { formatServerDateTimeAbsolute, formatServerDateTimeRelative } from '@/lib/time';
import './NoteCard.css';

/**
 * One note in the list.
 *
 * Takes a NoteView — a row as the UI wants it — rather than a wire type. The
 * difference that matters: `serverId` may be null for a note created offline,
 * and routing uses `localId`, which exists from the moment the note does.
 *
 * Actions moved out for now. 7D rebuilds them against the local store, where
 * pin and archive become a Dexie write plus a queued operation rather than a
 * request with an optimistic update.
 */
export function NoteCard({ note }: { note: NoteView }) {
  const title = note.title.trim();

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
    </li>
  );
}
