import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';

import { useAuth } from '@/app/providers/auth-context';
import { NoteEditorHost } from '@/features/editor/components/NoteEditorHost';
import { createLocalNote } from '@/features/notes/local/noteMappers';
import { noteRepository } from '@/features/notes/local/noteRepository';
import { Spinner } from '@/design-system/components/Spinner/Spinner';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';

import './NewNote.css';

/**
 * A new note.
 *
 * The row is created in Dexie IMMEDIATELY, before anything is typed — which is
 * the opposite of Step 6, where nothing existed until the first keystroke.
 *
 * The reason it is now safe: a local row costs nothing and never reaches the
 * server. The POST still fires only on the first edit (the row is created
 * clean, so `save` returns early while it is empty), so clicking "New note"
 * and changing your mind leaves an empty local row and no server note. Step 8
 * prunes those.
 *
 * What it buys is that the editor always has a row to write into, so there is
 * no "no id yet" state in the editor at all.
 */
export function NewNotePage() {
  useDocumentTitle('New note');

  const { state: authState } = useAuth();
  const currentUserId =
    authState.status === 'authenticated' || authState.status === 'refreshing'
      ? authState.user.id
      : null;

  const [localId, setLocalId] = useState<string | null>(null);

  useEffect(() => {
    if (currentUserId === null) return;

    // Created clean and not dirty: an untouched note is not something to save.
    const row = {
      ...createLocalNote(currentUserId),
      dirty: 0 as const,
      syncState: 'synced' as const,
    };
    void noteRepository.put(row).then(() => {
      setLocalId(row.localId);
      window.history.replaceState(null, '', `/notes/local/${row.localId}`);
    });
  }, [currentUserId]);

  const row = useLiveQuery(
    async () => (localId === null ? null : ((await noteRepository.getByLocalId(localId)) ?? null)),
    [localId],
  );

  if (!row) {
    return (
      <article className="new-note">
        <div className="new-note__centre">
          <Spinner label="Preparing a new note" />
        </div>
      </article>
    );
  }

  return (
    <article className="new-note">
      <NoteEditorHost key={row.localId} row={row} currentUserId={currentUserId} />
    </article>
  );
}
