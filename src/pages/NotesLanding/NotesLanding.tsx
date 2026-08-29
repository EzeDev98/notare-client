import { Plus } from 'lucide-react';
import { Link, Navigate } from 'react-router';

import type { NoteView } from '@/features/notes/local/noteMappers';
import { useNotes } from '@/features/notes/hooks/useNotes';
import { Button } from '@/design-system/components/Button/Button';
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
 * Step 14: no separate "No notes yet" heading any more — one line of
 * copy plus a direct "Create new note" action reads as an invitation,
 * not a status report. The action reuses the exact same /notes/new
 * route Notes.tsx's own empty state and the sidebar's "New note" already
 * point at — this is not a new way to create a note, just another entry
 * point to the existing one.
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
      <p className="notes-landing__body">Start a note to begin.</p>

      <Link className="notes-landing__cta" to="/notes/new">
        {/*
          --color-logo, not the standard `variant="primary"` accent — this
          one CTA is meant to read as the brand mark itself (see
          colors.css's own note on --color-logo), not as an ordinary
          button, so its colour is overridden in NotesLanding.css.
        */}
        <Button variant="primary" className="notes-landing__cta-button">
          Create new note
          <Plus aria-hidden="true" />
        </Button>
      </Link>
    </div>
  );
}
