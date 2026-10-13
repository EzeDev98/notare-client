import { sessionUserOf } from '@/features/auth/sessionUser';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';

import { useAuth } from '@/app/providers/auth-context';
import { newNotePath } from '@/features/notes/newNotePath';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import './NewNote.css';

export function NewNotePage() {
  const navigate = useNavigate();
  const { state: authState } = useAuth();
  const creationStartedRef = useRef(false);

  useDocumentTitle('New note');

  const currentUserId = sessionUserOf(authState)?.id ?? null;

  useEffect(() => {
    if (currentUserId === null || creationStartedRef.current) {
      return;
    }

    creationStartedRef.current = true;

    function open(path: string) {
      void navigate(path, { replace: true, state: { skipEnterAnimation: true } });
    }

    void newNotePath(currentUserId).then(open);
  }, [currentUserId, navigate]);

  return (
    <main className="new-note">
      <p className="new-note__status">Preparing a new note...</p>
    </main>
  );
}
