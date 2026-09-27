import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';

import { useAuth } from '@/app/providers/auth-context';
import { noteService } from '@/features/notes/api/noteService';
import { createLocalNote, fromNoteResponse } from '@/features/notes/local/noteMappers';
import { isEmptyNote } from '@/features/notes/local/isEmptyNote';
import { noteRepository } from '@/features/notes/local/noteRepository';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './NewNote.css';

export function NewNotePage() {
  const navigate = useNavigate();
  const { state: authState } = useAuth();
  const creationStartedRef = useRef(false);

  useDocumentTitle('New note');

  const currentUserId =
    authState.status === 'authenticated' || authState.status === 'refreshing'
      ? authState.user.id
      : null;

  useEffect(() => {
    if (currentUserId === null || creationStartedRef.current) {
      return;
    }

    creationStartedRef.current = true;

    void noteRepository.listActive(currentUserId).then(async (rows) => {
      /*
       * One empty note at a time — regardless of sync state. Reused below
       * for BOTH branches: a note this route creates is now saved to the
       * server immediately (see the comment further down), so "empty" and
       * "local-only" are no longer the same thing, and this check must not
       * be either.
       */
      const existingEmpty = rows.find((row) => isEmptyNote(row));

      if (existingEmpty) {
        void navigate(
          existingEmpty.serverId !== null
            ? `/notes/${String(existingEmpty.serverId)}`
            : `/notes/local/${existingEmpty.localId}`,
          {
            replace: true,
            state: { skipEnterAnimation: true },
          },
        );
        return;
      }

      /*
       * Saved on open, not deferred to the first keystroke. An empty note
       * used to stay local-only (no serverId) until the user typed
       * something, and VoiceRecorder only ever attaches to a note that
       * already has one (its own doc comment: voice notes are a
       * server-side link, there is no offline-pending upload path) — so
       * the mic stayed invisible until that first autosave round-tripped.
       * Creating the note on the server right away makes it available
       * immediately, at the cost of a genuinely empty note existing there
       * until the user writes into it or leaves it — which is exactly what
       * the "one empty note at a time" check above now guards against
       * regardless of where that note lives.
       *
       * Falls back to the previous local-only row when the request fails
       * (typically offline): the note still opens instantly, and the
       * ordinary create-on-first-edit path (`useNoteEditor`'s `save`)
       * picks it up exactly as it always has.
       */
      try {
        const created = await noteService.createNote({ content: '' });
        const row = fromNoteResponse(created);
        await noteRepository.put(row);

        void navigate(`/notes/${String(created.id)}`, {
          replace: true,
          state: { skipEnterAnimation: true },
        });
      } catch {
        const row = {
          ...createLocalNote(currentUserId),
          dirty: 0 as const,
          syncState: 'synced' as const,
        };
        await noteRepository.put(row);

        void navigate(`/notes/local/${row.localId}`, {
          replace: true,
          state: { skipEnterAnimation: true },
        });
      }
    });
  }, [currentUserId, navigate]);

  return (
    <main className="new-note">
      <p className="new-note__status">Preparing a new note...</p>
    </main>
  );
}
