import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useReducer, useRef } from 'react';

import { useAutoSaveScheduler } from '@/features/editor/hooks/useAutoSaveScheduler';
import { useConflict } from '@/features/editor/hooks/useConflict';
import { hasPendingWork, initialSaveState, saveReducer } from '@/features/editor/saveState';
import { noteService } from '@/features/notes/api/noteService';
import { fromNoteResponse } from '@/features/notes/local/noteMappers';
import { noteRepository } from '@/features/notes/local/noteRepository';
import type { NoteRow } from '@/features/notes/local/noteRow';
import { isConflict, isOffline } from '@/lib/http/errors';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';

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
  const row =
    useLiveQuery(async () => noteRepository.getByLocalId(localId), [localId]) ?? initialRow;

  /*
   * A ref for the save path only.
   *
   * Unlike 6E's mirror, this is never a second source of truth: it is refreshed
   * from the live query result, and nothing writes to it directly. The
   * scheduler needs a synchronous read at timer-fire time, and awaiting Dexie
   * inside the timer would be a second round trip for data already in hand.
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
    (changes: { title?: string; content?: string }) => {
      void noteRepository.applyLocalEdit(localId, changes);
      dispatch({ type: 'EDITED' });
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
            title: current.title,
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
          const textUnchanged =
            latest.title === current.title && latest.content === current.content;

          await noteRepository.put({
            ...fromNoteResponse(created, latest),
            title: latest.title,
            content: latest.content,
            dirty: textUnchanged ? 0 : 1,
            syncState: textUnchanged ? 'synced' : 'pending',
          });
        })();

        try {
          await creatingRef.current;
        } finally {
          creatingRef.current = null;
        }
      } else {
        if (current.version === null) {
          throw new Error('Cannot save a note without a version.');
        }

        const updated = await noteService.autoSaveNote(current.serverId, {
          title: current.title,
          content: current.content,
          // ECHOED, never incremented.
          version: current.version,
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
        const textUnchanged = latest.title === current.title && latest.content === current.content;

        await noteRepository.put({
          ...latest,
          serverId: updated.id,
          version: updated.version,
          updatedAt: updated.updatedAt,
          lastModifiedBy: updated.lastModifiedBy,
          dirty: textUnchanged ? 0 : 1,
          syncState: textUnchanged ? 'synced' : 'pending',
        });
      }

      dispatch({ type: 'SAVE_SUCCEEDED' });
    } catch (error) {
      if (isConflict(error)) {
        dispatch({ type: 'CONFLICT_DETECTED' });
      } else if (isOffline(error)) {
        /*
         * The row stays dirty and stays in the database. This is where
         * offline-first pays: the work is safe, and Step 8's outbox will push
         * it when the connection returns.
         */
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
    canSchedule: () =>
      saveStateRef.current.status !== 'offline' && saveStateRef.current.status !== 'conflict',
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

  const conflict = useConflict(row.serverId, saveState.status === 'conflict');

  /** KEEP MINE — a deliberate overwrite. Local text stays; version is swapped. */
  const keepMine = useCallback(() => {
    if (conflict.status !== 'ready') return;
    void noteRepository
      .put({ ...rowRef.current, version: conflict.theirs.version, dirty: 1 })
      .then(() => {
        dispatch({ type: 'CONFLICT_RESOLVED' });
        return scheduler.flush();
      });
  }, [conflict, scheduler]);

  /** USE THEIRS — discard the local draft. */
  const useTheirs = useCallback(() => {
    if (conflict.status !== 'ready') return;
    void noteRepository.put(fromNoteResponse(conflict.theirs, rowRef.current)).then(() => {
      dispatch({ type: 'CONFLICT_RESOLVED' });
    });
  }, [conflict]);

  /**
   * KEEP BOTH — the only option that destroys nothing.
   *
   * Theirs first, a divider, then mine. Untidy and recoverable, which is the
   * right trade when someone interrupted mid-sentence is about to click the
   * emphasised button.
   */
  const keepBoth = useCallback(() => {
    if (conflict.status !== 'ready') return;

    const theirs = conflict.theirs;
    const mine = rowRef.current;

    const theirContent = theirs.content ?? '';
    const mergedContent =
      theirContent.trim() === ''
        ? mine.content
        : `${theirContent}\n\n--- Your version ---\n\n${mine.content}`;

    const theirTitle = (theirs.title ?? '').trim();
    const mergedTitle =
      theirTitle === '' || theirTitle === mine.title.trim()
        ? mine.title
        : `${theirTitle} / ${mine.title}`;

    void noteRepository
      .put({
        ...mine,
        title: mergedTitle.slice(0, 255),
        content: mergedContent.slice(0, 20_000),
        version: theirs.version,
        dirty: 1,
        syncState: 'pending',
        localUpdatedAt: Date.now(),
      })
      .then(() => {
        dispatch({ type: 'CONFLICT_RESOLVED' });
        return scheduler.flush();
      });
  }, [conflict, scheduler]);

  return {
    row,
    saveState,
    setDraft,
    markEdited,
    save,
    flush: scheduler.flush,
    conflict,
    keepMine,
    useTheirs,
    keepBoth,
  };
}
