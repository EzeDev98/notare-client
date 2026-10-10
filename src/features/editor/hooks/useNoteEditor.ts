import { useStableLiveQuery as useLiveQuery } from '@/shared/hooks/useStableLiveQuery';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getDraft, persistDraftIfContent } from '@/features/notes/createNote';
import { noteRepository, outboxRepository } from '@/features/notes/local/noteRepository';
import type { NoteRow } from '@/features/notes/local/noteRow';
import { isQuotaError, setStorageFull } from '@/features/notes/status/storageFull';

/**
 * See `draftOverride`'s own doc comment below for what this is for.
 * 1B: no `title` field — the note domain has none (NoteRow, NoteResponse,
 * CreateNoteRequest, UpdateNoteRequest and AutoSaveNoteRequest all dropped
 * it). Content is the only text a note carries now.
 */
interface DraftOverride {
  content: string;
}

/**
 * The editor, with LOCAL STORAGE as the source of truth.
 *
 * WHAT THIS RETIRES, and it is worth being explicit because both cost real
 * time in Step 6:
 *
 *   THE TAB-CLOSE LOSS (6C). No browser API lets an unload handler await a
 *   request with an auth header, so up to ~1.2s of typing could vanish. Now
 *   every keystroke is already in IndexedDB before the request is even
 *   scheduled — the network save is no longer the only copy.
 *
 *   THE STATE/REF MIRROR (6E). useNoteDraft held the draft in React state with
 *   a ref alongside it, kept in sync by hand. It was wrong twice: once because
 *   a render-time assignment undid every synchronous write, and once because I
 *   spent three rounds diagnosing that from the outside. There is now ONE
 *   place holding the draft, and the UI observes it.
 *
 * LOCAL WRITES ARE NOT DEBOUNCED. A keystroke costs an IndexedDB put —
 * microseconds, and it never leaves the machine. There is no autosave timer
 * any more (step 8f): the sync engine pushes the outbox shortly after the last
 * change.
 */
export function useNoteEditor(initialRow: NoteRow) {
  /*
   * The editor host remains mounted while navigation changes the
   * selected note. localId therefore MUST follow the incoming row.
   *
   * The previous implementation relied on React remounting this
   * hook through <NoteEditorHost key={row.localId}>. That made every
   * note switch destroy and recreate the entire editor.
   */
  const localId = initialRow.localId;

  /*
   * THE DRAFT, read from the database.
   *
   * Not a copy in React state — this IS the note. A write from anywhere,
   * including another tab, re-renders the editor with the current value.
   *
   * The fallback to initialRow covers the first render before Dexie answers,
   * so the editor never flashes empty.
   */
  const liveRow =
    useLiveQuery(async () => noteRepository.getByLocalId(localId), [localId]) ?? initialRow;

  /*
   * THE OPTIMISTIC OVERRIDE.
   *
   * `liveRow` above is honest but SLOW: a keystroke's write goes through
   * `db.notes.put`, an actual IndexedDB transaction, and `useLiveQuery` only
   * re-emits once that transaction's change event fires — one or more
   * event-loop ticks later, never in the same render pass as the keystroke
   * that caused it.
   *
   * `EditorSurface`'s content is CONTROLLED, bound directly to whatever
   * `row` this hook returns. Every `setDraft` call dispatches `EDITED`,
   * which re-renders `NoteEditorHost` immediately — and if `row` at that
   * render is still `liveRow` (unchanged, because Dexie hasn't caught up),
   * React resets the controlled input's DOM value back to that stale prop,
   * undoing what was just typed. Type fast enough and every keystroke
   * lands on a freshly-reverted field: each character is the entire
   * visible content for a moment, and only whichever one the debounced
   * save happens to fire on ever reaches the server. This was the actual
   * cause behind four failing tests that looked unrelated
   * (conflict.test.tsx, editorRaces.test.tsx, keepBoth.test.tsx,
   * offlineEdit.test.tsx) — all of them either render the controlled
   * surface and race it, or read `rowRef.current` synchronously right
   * after `setDraft` and see the pre-edit row because the live query has
   * not resolved yet.
   *
   * The fix is NOT 6E's state/ref mirror (deleted for exactly the "two
   * sources of truth kept in sync by hand" reason its own comment above
   * gives). This is narrower: an override that exists ONLY between "the
   * user just typed something" and "Dexie caught up with it", cleared the
   * moment `liveRow` matches it. Cross-tab and initial-load behaviour is
   * untouched — this never overrides `liveRow` with anything the CURRENT
   * tab did not just type.
   */
  const [draftOverride, setDraftOverride] = useState<DraftOverride | null>(null);

  const previousLocalIdRef = useRef(localId);

  useEffect(() => {
    if (previousLocalIdRef.current !== localId) {
      previousLocalIdRef.current = localId;

      /*
       * The optimistic override belongs to the previous note.
       * Clear it before the new note becomes authoritative.
       */
      setDraftOverride(null);
    }
  }, [localId]);

  useEffect(() => {
    if (draftOverride !== null && liveRow.content === draftOverride.content) {
      setDraftOverride(null);
    }
  }, [liveRow, draftOverride]);

  const row =
    draftOverride === null
      ? liveRow
      : {
          ...liveRow,
          content: draftOverride.content,
          // Forced, not read from liveRow: `save()`'s "nothing to send"
          // check reads this synchronously via `rowRef`, and liveRow's
          // `dirty` is exactly as stale as its content is while an
          // override is active.
          dirty: 1 as const,
        };

  /*
   * A ref for the save path only.
   *
   * Unlike 6E's mirror, this is never a second source of truth: it is refreshed
   * from the live query result (plus the override above), and nothing writes to
   * it directly. The scheduler needs a synchronous read at timer-fire time, and
   * awaiting Dexie inside the timer would be a second round trip for data
   * already in hand.
   */
  const rowRef = useRef(row);
  rowRef.current = row;

  /*
   * Edits are written in order, one after another. A later keystroke can then
   * never be overtaken by an earlier one that happened to finish last.
   */
  const writeChainRef = useRef<Promise<void>>(Promise.resolve());

  /**
   * Writes a change to LOCAL STORAGE and to the outbox, immediately.
   *
   * Nothing is debounced. A keystroke costs one IndexedDB put on one row. The
   * outbox keeps ONE row per note (the newest text), and the sync engine
   * pushes it SYNC_AFTER_CHANGE_MS after the last change (step 8f, M-10).
   */
  const setDraft = useCallback(
    (changes: { content?: string }) => {
      // Synchronous first — see draftOverride's own doc comment above.
      const next = {
        content: changes.content ?? rowRef.current.content,
      };
      setDraftOverride(next);

      // A new note is only in memory until it has text (createNote.ts).
      const draft = getDraft(localId);
      if (draft) draft.content = next.content;

      writeChainRef.current = writeChainRef.current
        .then(async () => {
          const pending = getDraft(localId);
          if (pending) {
            // The first non-blank character writes the row and queues its CREATE.
            if ((await persistDraftIfContent(pending)) === null) return;
          }

          await noteRepository.applyLocalEdit(localId, changes);

          // Read back, so the queued operation matches what is now on disk
          // (the note may have gained a server id since the last keystroke).
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
        })
        .catch((error: unknown) => {
          if (isQuotaError(error)) setStorageFull(true);
        });
    },
    [localId],
  );

  /** Resolves once every edit made so far is on this device. Cmd/Ctrl+S uses it. */
  const flush = useCallback((): Promise<void> => writeChainRef.current, []);

  return {
    row,
    setDraft,
    flush,
  };
}
