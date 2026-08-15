import { Navigate } from 'react-router';

import type { NoteView } from '@/features/notes/local/noteMappers';
import { useNotes } from '@/features/notes/hooks/useNotes';
import { Spinner } from '@/design-system/components/Spinner/Spinner';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './NotesLanding.css';

// Same routing convention SidebarNoteItem and NoteCard already use —
// localId for a note this device created offline and has no server id
// for yet, serverId once it does.
function routeFor(note: NoteView): string {
  return note.serverId === null ? `/notes/local/${note.localId}` : `/notes/${String(note.serverId)}`;
}

/**
 * `/notes`, the bare route with no id — what the root redirect lands on.
 *
 * NOT the note list anymore. That's the sidebar's job now (AppLayout.tsx,
 * ≥1024px). This route's only job is deciding what the MAIN content area
 * shows before any note is explicitly opened:
 *
 *   - notes exist  -> immediately open the first one (redirect to its
 *     own route) — "first" meaning exactly what the sidebar list shows
 *     first: pinned notes, then most recently touched
 *     (noteRepository.ts's own `byPinnedThenRecent`), so this and the
 *     sidebar's top row always agree on what "the latest note" is.
 *   - no notes yet -> a centred empty state, not a blank rectangle.
 *
 * `/notes/new` and `/notes/:noteId` are untouched, separate routes — this
 * component only ever renders for the bare `/notes` path itself.
 */
export function NotesLandingPage() {
  useDocumentTitle('Notes');

  const { notes } = useNotes();

  // undefined for one instant before Dexie's first answer (useNotes' own
  // doc comment) — a brief spinner rather than flashing the empty state
  // and then immediately replacing it once real data arrives.
  if (notes === undefined) {
    return (
      <div className="notes-landing notes-landing--centre">
        <Spinner label="Loading your notes" />
      </div>
    );
  }

  if (notes.length > 0) {
    const latest = notes[0];
    if (latest) return <Navigate to={routeFor(latest)} replace />;
  }

  return (
    <div className="notes-landing notes-landing--centre">
      <h1 className="notes-landing__title">No notes yet</h1>
      <p className="notes-landing__body">Start a note to begin.</p>
    </div>
  );
}
