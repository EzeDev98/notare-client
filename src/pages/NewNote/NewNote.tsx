import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';

import { useAuth } from '@/app/providers/auth-context';
import { ROUTES } from '@/app/routes';
import { findBlankDraft, startDraft } from '@/features/notes/createNote';
import { clipRepository } from '@/features/notes/local/clipRepository';
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

    function open(path: string) {
      void navigate(path, { replace: true, state: { skipEnterAnimation: true } });
    }

    void (async () => {
      // One blank note at a time. A blank draft already open is reused.
      const draft = findBlankDraft();
      if (draft) {
        open(ROUTES.legacy.noteLocal(draft.id));
        return;
      }

      // A blank note already on this device (from before drafts) is reused too.
      const rows = await noteRepository.listActive(currentUserId);
      for (const row of rows) {
        const clipCount = await clipRepository.countForNote(row.localId);
        if (isEmptyNote({ content: row.content, clipCount })) {
          open(ROUTES.legacy.noteOf(row));
          return;
        }
      }

      // Nothing is written. The note exists once the person types.
      open(ROUTES.legacy.noteLocal(startDraft(currentUserId).id));
    })();
  }, [currentUserId, navigate]);

  return (
    <main className="new-note">
      <p className="new-note__status">Preparing a new note...</p>
    </main>
  );
}
