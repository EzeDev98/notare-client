/** Connects the editor to the note stored on the device. */
import { useStableLiveQuery as useLiveQuery } from '@/shared/hooks/useStableLiveQuery';
import { useCallback, useEffect, useRef } from 'react';

import { getDraft, persistDraftIfContent } from '@/features/notes/createNote';
import { noteRepository, outboxRepository } from '@/features/notes/local/noteRepository';
import type { NoteRow } from '@/features/notes/local/noteRow';
import { isQuotaError, setStorageFull, useStorageFull } from '@/features/notes/status/storageFull';

export function useNoteEditor(initialRow: NoteRow) {
  const localId = initialRow.localId;

  const row = useLiveQuery(async () => noteRepository.getByLocalId(localId), [localId]) ?? initialRow;

  const writeChainRef = useRef<Promise<void>>(Promise.resolve());

  const unsavedRef = useRef<{ content: string; bodyState: Uint8Array } | null>(null);
  const storageFull = useStorageFull();

  const setDraft = useCallback(
    (changes: { content: string; bodyState: Uint8Array }) => {
      const draft = getDraft(localId);
      if (draft) draft.content = changes.content;

      writeChainRef.current = writeChainRef.current
        .then(async () => {
          const pending = getDraft(localId);
          if (pending) {
            if ((await persistDraftIfContent(pending)) === null) return;
          }

          await noteRepository.applyLocalEdit(localId, changes);

          const latest = await noteRepository.getByLocalId(localId);
          if (!latest) return;

          if (latest.serverId === null) {
            await outboxRepository.enqueueCreate({
              localId,
              clientId: latest.clientId,
              content: latest.content,
            });
          } else {
            await outboxRepository.enqueueUpdate({
              localId,
              noteId: latest.serverId,
              content: latest.content,
            });
          }

          setStorageFull(false);
          unsavedRef.current = null;
        })
        .catch((error: unknown) => {
          if (!isQuotaError(error)) return;
          unsavedRef.current = changes;
          setStorageFull(true);
        });
    },
    [localId],
  );

  useEffect(() => {
    if (storageFull || !unsavedRef.current) return;
    setDraft(unsavedRef.current);
  }, [storageFull, setDraft]);

  const flush = useCallback((): Promise<void> => writeChainRef.current, []);

  return { row, setDraft, flush };
}
