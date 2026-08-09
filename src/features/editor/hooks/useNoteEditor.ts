import { useCallback, useEffect, useReducer, useRef } from 'react';

import { useAutoSaveScheduler } from '@/features/editor/hooks/useAutoSaveScheduler';
import { toSavePayload, useNoteDraft, type DraftState } from '@/features/editor/hooks/useNoteDraft';
import { useConflict } from '@/features/editor/hooks/useConflict';
import { hasPendingWork, initialSaveState, saveReducer } from '@/features/editor/saveState';
import { noteService } from '@/features/notes/api/noteService';
import type { NoteResponse } from '@/features/notes/types';
import { isConflict, isOffline } from '@/lib/http/errors';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';

/**
 * Draft state, the save-state machine, and the ability to persist.
 *
 * 6C replaces the caller's save-on-blur with a scheduler. The save PATH does
 * not change — only what decides to call it.
 */
export function useNoteEditor(initial: NoteResponse | null) {
  const draft = useNoteDraft(initial);
  const [saveState, dispatch] = useReducer(saveReducer, initialSaveState);
  const online = useOnlineStatus();

  /*
   * navigator.onLine can be trusted only when it says FALSE — it reports
   * whether an interface is up, so a router with a broken uplink says true.
   * The reliable signal is a request that failed, which the catch below
   * handles.
   */
  useEffect(() => {
    dispatch(online ? { type: 'WENT_ONLINE' } : { type: 'WENT_OFFLINE' });
  }, [online]);

  /*
   * CREATION IS SINGLE-FLIGHT.
   *
   * Between the first keystroke and the POST returning there is no note id,
   * and more edits arrive in that window. Without this, a second save also
   * finds no id and creates a SECOND NOTE — the user types one note and ends
   * up with two, each holding half their words.
   *
   * A ref, because a re-entry guard has to be true synchronously and a state
   * update lands a render too late.
   */
  const creatingRef = useRef<Promise<NoteResponse> | null>(null);

  /**
   * Persists the current draft.
   *
   * NO AbortSignal, and that is deliberate rather than an omission.
   *
   * 5E cancels superseded SEARCHES, and the instinct is to do the same here.
   * Aborting a read discards a result nobody wants; aborting a write discards
   * the USER'S WORDS — and does so ambiguously, since the request may already
   * have reached the server. That ambiguity is exactly why 3D classifies a
   * timeout as isOffline ("we do not know") rather than as a failure.
   *
   * A save therefore has a TIMEOUT but never a CANCELLATION. On unmount the
   * pending save is fired and left to complete: fire-and-forget would be
   * sloppy for a read and is correct for a write.
   */
  const save = useCallback(async (): Promise<NoteResponse | null> => {
    const current = draft.stateRef.current;
    const payload = toSavePayload(current);

    // Nothing changed. PATCH would be a server-side no-op anyway (Hibernate
    // issues no UPDATE for unchanged values), but not sending it keeps the
    // indicator honest.
    if (Object.keys(payload).length === 0) return null;

    dispatch({ type: 'SAVE_STARTED' });

    try {
      const result = await performSave(current, payload, creatingRef);
      draft.acceptSaved(result);
      dispatch({ type: 'SAVE_SUCCEEDED' });
      return result;
    } catch (error) {
      if (isConflict(error)) {
        // Its own state, not an error: a conflict is a product feature (§20),
        // and 6E gives the user a way through it.
        dispatch({ type: 'CONFLICT_DETECTED' });
      } else if (isOffline(error)) {
        dispatch({ type: 'WENT_OFFLINE' });
      } else {
        dispatch({ type: 'SAVE_FAILED', retryable: true });
      }
      throw error;
    }
  }, [draft]);

  /*
   * The scheduler reads save state through a ref rather than a dependency, so
   * it is not recreated on every state change — and so `canSchedule` sees the
   * CURRENT state when the timer fires rather than the state as it was when
   * the timer was set.
   */
  const saveStateRef = useRef(saveState);
  saveStateRef.current = saveState;

  const scheduler = useAutoSaveScheduler({
    save,
    // Nothing is scheduled while offline or in conflict. Offline saves would
    // fail on a loop; a conflicting save would overwrite someone else's work,
    // which §20 rules out.
    canSchedule: () =>
      saveStateRef.current.status !== 'offline' && saveStateRef.current.status !== 'conflict',
    hasPendingWork: () => hasPendingWork(saveStateRef.current),
  });

  /** Called on every keystroke: records the edit and (re)starts the timer. */
  const markEdited = useCallback(() => {
    dispatch({ type: 'EDITED' });
    scheduler.schedule();
  }, [scheduler]);

  /*
   * Coming back online: fire immediately rather than waiting for the next
   * keystroke. A user who reconnects and walks away should not lose work
   * because they stopped typing before the connection returned.
   */
  useEffect(() => {
    if (online && hasPendingWork(saveStateRef.current)) {
      void scheduler.flush();
    }
  }, [online, scheduler]);

  /* Only fetched once a conflict exists — one GET, at a moment the user has
   * already stopped to read something. */
  const conflict = useConflict(draft.state.noteId, saveState.status === 'conflict');

  /**
   * KEEP MINE — a deliberate overwrite.
   *
   * The draft is untouched; only the version is swapped for the server's, so
   * the next save is accepted rather than rejected as stale. The other
   * person's words are gone, and the user chose that.
   */
  const keepMine = useCallback(() => {
    if (conflict.status !== 'ready') return;
    draft.adoptVersion(conflict.theirs.version);
    dispatch({ type: 'CONFLICT_RESOLVED' });
    void scheduler.flush();
  }, [conflict, draft, scheduler]);

  /** USE THEIRS — discard the local draft entirely. */
  const useTheirs = useCallback(() => {
    if (conflict.status !== 'ready') return;
    draft.replaceWith(conflict.theirs);
    dispatch({ type: 'CONFLICT_RESOLVED' });
    // No save: the draft now equals the server's copy, so there is nothing to
    // send. The scheduler's empty-payload check handles it either way.
  }, [conflict, draft]);

  /**
   * KEEP BOTH — the only option that destroys nothing.
   *
   * Theirs first, a divider, then mine. Untidy and recoverable, which is the
   * right trade when a person interrupted mid-sentence is about to click
   * something.
   *
   * Titles are joined the same way rather than picking one, for the same
   * reason: choosing silently discards the other.
   */
  const keepBoth = useCallback(() => {
    if (conflict.status !== 'ready') return;

    const theirs = conflict.theirs;
    const mine = draft.stateRef.current.draft;

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

    draft.adoptVersion(theirs.version);
    draft.setDraft({ title: mergedTitle.slice(0, 255), content: mergedContent.slice(0, 20_000) });
    dispatch({ type: 'CONFLICT_RESOLVED' });
    void scheduler.flush();
  }, [conflict, draft, scheduler]);

  return {
    ...draft,
    save,
    saveState,
    markEdited,
    flush: scheduler.flush,
    conflict,
    keepMine,
    useTheirs,
    keepBoth,
    dispatch,
  };
}

/** The request itself, so the state transitions above read as one story. */
async function performSave(
  current: DraftState,
  payload: { title?: string; content?: string },
  creatingRef: { current: Promise<NoteResponse> | null },
): Promise<NoteResponse> {
  if (current.noteId === null) {
    /*
     * Join an in-flight creation rather than starting a second one. The joiner
     * does not re-send its own text — it waits for the id, and the scheduler
     * issues a follow-up PATCH with whatever has been typed since.
     */
    creatingRef.current ??= noteService.createNote({
      title: current.draft.title,
      content: current.draft.content,
    });

    try {
      return await creatingRef.current;
    } finally {
      creatingRef.current = null;
    }
  }

  if (current.version === null) {
    // Unreachable: an id implies a version. Explicit rather than a non-null
    // assertion, because a wrong assertion sends `undefined` as a version and
    // the server answers 400 with nothing to explain it.
    throw new Error('Cannot save a note without a version.');
  }

  return noteService.autoSaveNote(current.noteId, {
    ...payload,
    // ECHOED, never incremented. Sending version + 1 conflicts exactly as a
    // stale one does — the client quotes the token, it does not count.
    version: current.version,
  });
}
