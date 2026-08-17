import { useLiveQuery } from 'dexie-react-hooks';
import { useParams } from 'react-router';

import { useAuth } from '@/app/providers/auth-context';
import { NoteEditorHost } from '@/features/editor/components/NoteEditorHost';
import { noteRepository } from '@/features/notes/local/noteRepository';
import './LocalNoteDetail.css';

export function LocalNoteDetailPage() {
  const { localId } = useParams<{ localId: string }>();
  const { state: authState } = useAuth();

  const currentUserId =
    authState.status === 'authenticated' || authState.status === 'refreshing'
      ? authState.user.id
      : null;

  const row = useLiveQuery(
    async () => {
      if (!localId) {
        return null;
      }

      return (await noteRepository.getByLocalId(localId)) ?? null;
    },
    [localId],
  );

  if (row === undefined) {
    return null;
  }

  if (row === null) {
    return (
      <main className="local-note-detail">
        <p className="local-note-detail__status">Note not found.</p>
      </main>
    );
  }

  return (
    <NoteEditorHost
      key={row.localId}
      row={row}
      currentUserId={currentUserId}
    />
  );
}
