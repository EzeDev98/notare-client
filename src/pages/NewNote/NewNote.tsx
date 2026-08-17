import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';

import { useAuth } from '@/app/providers/auth-context';
import { createLocalNote } from '@/features/notes/local/noteMappers';
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

    const row = {
      ...createLocalNote(currentUserId),
      dirty: 0 as const,
      syncState: 'synced' as const,
    };

    void noteRepository.put(row).then(() => {
      void navigate(`/notes/local/${row.localId}`, {
        replace: true,
      });
    });
  }, [currentUserId, navigate]);

  return (
    <main className="new-note">
      <p className="new-note__status">Preparing a new note...</p>
    </main>
  );
}
