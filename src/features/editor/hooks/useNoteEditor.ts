import { useStableLiveQuery as useLiveQuery } from '@/shared/hooks/useStableLiveQuery';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import { useAutoSaveScheduler } from '@/features/editor/hooks/useAutoSaveScheduler';
import {
  hasPendingWork,
  initialSaveState,
  saveReducer,
} from '@/features/editor/saveState';
import { noteService } from '@/features/notes/api/noteService';
import { fromNoteResponse } from '@/features/notes/local/noteMappers';
import { noteRepository, outboxRepository } from '@/features/notes/local/noteRepository';
import type { NoteRow } from '@/features/notes/local/noteRow';
import { isOffline } from '@/lib/http/errors';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';

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
 * microseconds, and it never leaves the machine. Debouncing it would recreate
 * the loss window for no benefit. The 1.2s debounce now applies only to the
 * network request.
 */
export function useNoteEditor(initialRow: NoteRow) {
  const [saveState, dispatch] = useReducer(saveReducer, initialSaveState);
  const online = useOnlineStatus();

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

  useEffect(() => {
    dispatch(online ? { type: 'WENT_ONLINE' } : { type: 'WENT_OFFLINE' });
  }, [online]);

  /*
   * Creation is single-flight. Between the first keystroke and the POST
   * returning there is no server id, and a second save would create a SECOND
   * NOTE holding half the user's words.
   */
  const creatingRef = useRef<Promise<void> | null>(null);

  /**
   * Writes a change to LOCAL STORAGE, immediately.
   *
   * This is the save that matters. The network one is reconciliation.
   */
  const setDraft = useCallback(
    (changes: { content?: string }) => {
      // Synchronous first — see draftOverride's own doc comment above.
      // Reads rowRef, not `row`/`liveRow` directly, so a second setDraft
      // call before Dexie catches up still merges onto the FIRST call's
      // override rather than the stale pre-edit row.
      const next = {
        content: changes.content ?? rowRef.current.content,
      };
      setDraftOverride(next);
      void noteRepository.applyLocalEdit(localId, changes);
      dispatch({ type: 'EDITED' });

      /*
       * Keeps an already-queued outbox row current with every further
       * edit — a no-op when nothing is queued (the common case). See
       * `syncQueuedContent`'s own doc comment for why this runs
       * UNCONDITIONALLY rather than gated on `saveState.status ===
       * 'offline'`: that gate looks right but races the same dispatch
       * that put the row there in the first place. Checking the outbox
       * table directly has no such window.
       */
      void outboxRepository.syncQueuedContent(localId, next.content);
    },
    [localId],
  );

  /** Pushes the local row to the server. Throws; the caller interprets. */
  const save = useCallback(async (): Promise<void> => {
    const current = rowRef.current;

    // Nothing to send. The row is clean, so the server already has this.
    if (current.dirty === 0) return;

    dispatch({ type: 'SAVE_STARTED' });

    try {
      if (current.serverId === null) {
        // Join an in-flight creation rather than starting a second one.
        creatingRef.current ??= (async () => {
          const created = await noteService.createNote({
            content: current.content,
          });

          /*
           * RE-READ BEFORE WRITING — the same guard the update branch below
           * has, and its absence here was a live data-loss bug.
           *
           * A POST is slow and the user keeps typing. fromNoteResponse marks
           * the row CLEAN and carries the server's echo of the OLDER text, so
           * writing it wholesale did two things at once: overwrote the newer
           * local content, and cleared `dirty` so nothing would ever push it.
           * Everything typed during the round trip disappeared on the next
           * render, silently.
           *
           * The row keeps its localId and clientId either way — same note, now
           * with a server id, so every reference to it stays valid.
           */
          const latest = (await noteRepository.getByLocalId(localId)) ?? current;
          const textUnchanged = latest.content === current.content;

          await noteRepository.put({
            ...fromNoteResponse(created, latest),
            content: latest.content,
            dirty: textUnchanged ? 0 : 1,
            syncState: textUnchanged ? 'synced' : 'pending',
          });

          /*
           * 8B: drop a queued CREATE for this note if one exists.
           *
           * It would exist if an earlier offline attempt already enqueued
           * one and THIS attempt is a reconnect retry that just succeeded
           * directly. Leaving it would mean 8C creates the SAME note a
           * second time once the outbox is drained.
           */
          await outboxRepository.clearForNote(localId);
        })();

        try {
          await creatingRef.current;
        } finally {
          creatingRef.current = null;
        }
      } else {
        const updated = await noteService.autoSaveNote(current.serverId, {
          content: current.content,
        });

        /*
         * Re-read before writing.
         *
         * The user may have typed while the request was in flight, and the
         * server's echo is of the OLDER text. Writing the response wholesale
         * would overwrite newer local content with a stale copy — the single
         * worst thing an editor can do.
         *
         * So: take the server's version and timestamps, keep whatever text is
         * currently local, and stay dirty if it has moved on.
         */
        const latest = (await noteRepository.getByLocalId(localId)) ?? current;
        const textUnchanged = latest.content === current.content;

        await noteRepository.put({
          ...latest,
          serverId: updated.id,
          version: updated.version,
          updatedAt: updated.updatedAt,
          lastModifiedBy: updated.lastModifiedBy,
          dirty: textUnchanged ? 0 : 1,
          syncState: textUnchanged ? 'synced' : 'pending',
        });

        // 8B: same reasoning as the CREATE branch above — a direct success
        // retires whatever this note had queued, since the outbox's copy is
        // now either applied already or superseded by what was just sent.
        await outboxRepository.clearForNote(localId);
      }

      dispatch({ type: 'SAVE_SUCCEEDED' });
    } catch (error) {
      if (isOffline(error)) {
        /*
         * The row stays dirty and stays in the database. That was already
         * true before 8B — this is where offline-first pays.
         *
         * WHAT 8B ADDS: the attempt is now recorded in the outbox, so this
         * note no longer depends on THIS EDITOR STAYING OPEN to ever reach
         * the server. 8C's batch push can pick it up from a cold start —
         * the app reopened, or a different note's editor open instead.
         *
         * Read the freshest row rather than `current`: the fetch fails close
         * to instantly, but a coalesced re-queue should always carry
         * whatever is newest, the same discipline the success path already
         * applies just above.
         *
         * `current` (not a fresh Dexie read) is what actually carries the
         * newest text now that `rowRef` includes the optimistic override —
         * before this fix, a second offline edit arriving while the first
         * save() was still in flight could read a Dexie row one keystroke
         * behind the override, coalesce against THAT, and leave the freshly
         * typed tail stranded outside the queued row.
         */
        const latest = (await noteRepository.getByLocalId(localId)) ?? current;
        const newestContent =
          latest.localUpdatedAt >= current.localUpdatedAt ? latest.content : current.content;

        if (current.serverId === null) {
          await outboxRepository.enqueueCreate({
            localId,
            clientId: latest.clientId,
            content: newestContent,
          });
        } else {
          await outboxRepository.enqueueUpdate({
            localId,
            noteId: current.serverId,
            content: newestContent,
          });
        }

        dispatch({ type: 'WENT_OFFLINE' });
      } else {
        dispatch({ type: 'SAVE_FAILED', retryable: true });
      }
      throw error;
    }
  }, [localId]);

  const saveStateRef = useRef(saveState);
  saveStateRef.current = saveState;

  const scheduler = useAutoSaveScheduler({
    save,
    canSchedule: () => saveStateRef.current.status !== 'offline',
    hasPendingWork: () => hasPendingWork(saveStateRef.current),
  });

  const markEdited = useCallback(() => {
    scheduler.schedule();
  }, [scheduler]);

  /* Reconnecting flushes without waiting for the next keystroke. */
  useEffect(() => {
    if (online && hasPendingWork(saveStateRef.current)) {
      void scheduler.flush();
    }
  }, [online, scheduler]);

  return {
    row,
    saveState,
    setDraft,
    markEdited,
    save,
    flush: scheduler.flush,
  };
}
