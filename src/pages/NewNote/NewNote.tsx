import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';

import { useAuth } from '@/app/providers/auth-context';
import { NoteEditorHost } from '@/features/editor/components/NoteEditorHost';
import { createLocalNote, fromNoteResponse } from '@/features/notes/local/noteMappers';
import { noteRepository } from '@/features/notes/local/noteRepository';
import { noteService } from '@/features/notes/api/noteService';
import { VoiceRecorder } from '@/features/voice/components/VoiceRecorder/VoiceRecorder';
import { Spinner } from '@/design-system/components/Spinner/Spinner';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';

import './NewNote.css';

/**
 * A new note.
 *
 * The note is created locally and on the server as part of the "New Note"
 * action itself. This means a brand-new note immediately has a serverId,
 * allowing all note-scoped features — including voice recording — to be
 * available before the user types anything.
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

    let cancelled = false;

    async function createNote() {
      const localRow = {
        ...createLocalNote(currentUserId),
        dirty: 0 as const,
        syncState: 'synced' as const,
      };

      /*
       * Put the local row first so the note has a stable local identity even
       * if the network request is still in flight.
       */
      await noteRepository.put(localRow);

      if (cancelled) return;

      setLocalId(localRow.localId);
      window.history.replaceState(null, '', `/notes/local/${localRow.localId}`);

      try {
        /*
         * The "New Note" action itself creates the server note. This is
         * intentionally done before the first keystroke so the note already
         * has a serverId when the editor opens.
         */
        const created = await noteService.createNote({
          title: '',
          content: '',
        });

        if (cancelled) return;

        const latest = (await noteRepository.getByLocalId(localRow.localId)) ?? localRow;

        await noteRepository.put({
          ...fromNoteResponse(created, latest),
          title: latest.title,
          content: latest.content,
          dirty: latest.dirty,
          syncState: latest.dirty === 1 ? 'pending' : 'synced',
        });
      } catch {
        /*
         * Keep the local note alive if the initial server create fails.
         * The existing editor/sync flow can reconcile it when connectivity
         * returns. The recorder will become available as soon as the row
         * receives its serverId.
         */
      }
    }

    void createNote();

    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  const row = useLiveQuery(
    async () =>
      localId === null
        ? null
        : ((await noteRepository.getByLocalId(localId)) ?? null),
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
      <div className="new-note__scroll">
        <NoteEditorHost
          key={row.localId}
          row={row}
          currentUserId={currentUserId}
        />
      </div>

      {row.serverId !== null ? (
        <VoiceRecorder noteId={row.serverId} />
      ) : null}
    </article>
  );
}
