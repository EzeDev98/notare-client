import { useStableLiveQuery as useLiveQuery } from '@/shared/hooks/useStableLiveQuery';
import { useCallback, useEffect, useRef } from 'react';

import { getDraft, persistDraftIfContent } from '@/features/notes/createNote';
import { noteRepository, outboxRepository } from '@/features/notes/local/noteRepository';
import type { NoteRow } from '@/features/notes/local/noteRow';
import { isQuotaError, setStorageFull, useStorageFull } from '@/features/notes/status/storageFull';

/**
 * The editor's link to local storage (steps 6, 8, 12c).
 *
 * The Y.Doc (useNoteBody.ts) is the only copy of the draft. This hook holds no
 * copy of the text: it gives the host the note's live row (ids, dates)
 * and writes each change to IndexedDB and the outbox.
 *
 * LOCAL WRITES ARE NOT DEBOUNCED. A change costs an IndexedDB put and never
 * leaves the machine. There is no autosave timer (step 8f): the sync engine
 * pushes the outbox shortly after the last change.
 */
export function useNoteEditor(initialRow: NoteRow) {
  const localId = initialRow.localId;

  // This IS the note. A write from anywhere, including another tab, shows up
  // here. The fallback covers the first render, before Dexie answers.
  const row = useLiveQuery(async () => noteRepository.getByLocalId(localId), [localId]) ?? initialRow;

  /*
   * Writes happen one after another, so a later change can never be overtaken
   * by an earlier one that happened to finish last. This is a queue of
   * promises, not a copy of the note.
   */
  const writeChainRef = useRef<Promise<void>>(Promise.resolve());

  // The newest change that could not be written because the device is full (14c).
  // The text is also still in the Y.Doc; this is what gets written again once there is room.
  const unsavedRef = useRef<{ content: string; bodyState: Uint8Array } | null>(null);
  const storageFull = useStorageFull();

  /**
   * Writes a change to local storage and to the outbox. `content` is the text
   * derived from the body, `bodyState` the body itself; both go in one write.
   * The outbox keeps one row per note (the newest text).
   */
  const setDraft = useCallback(
    (changes: { content: string; bodyState: Uint8Array }) => {
      // A new note is only in memory until it has text (createNote.ts).
      const draft = getDraft(localId);
      if (draft) draft.content = changes.content;

      writeChainRef.current = writeChainRef.current
        .then(async () => {
          const pending = getDraft(localId);
          if (pending) {
            // The first non-blank character writes the row and queues its CREATE.
            if ((await persistDraftIfContent(pending)) === null) return;
          }

          await noteRepository.applyLocalEdit(localId, changes);

          // Read back, so the queued operation matches what is now on disk
          // (the note may have gained a server id since the last change).
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

          // A write worked, so the device is not full (step 8h).
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

  // Space was freed: write what could not be saved while the banner showed.
  useEffect(() => {
    if (storageFull || !unsavedRef.current) return;
    setDraft(unsavedRef.current);
  }, [storageFull, setDraft]);

  /** Resolves once every change made so far is on this device. Cmd/Ctrl+S uses it. */
  const flush = useCallback((): Promise<void> => writeChainRef.current, []);

  return { row, setDraft, flush };
}
