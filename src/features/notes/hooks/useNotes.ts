import { useCallback, useEffect, useRef, useState } from 'react';

import { noteService } from '@/features/notes/api/noteService';
import type { NoteSummaryResponse } from '@/features/notes/types';
import { isAborted } from '@/lib/http/errors';

const PAGE_SIZE = 20;

export type NotesState =
  | { status: 'loading' }
  | {
      status: 'ready';
      notes: NoteSummaryResponse[];
      hasNext: boolean;
      total: number;
    }
  | { status: 'error'; message: string };

/**
 * The owner's notes, accumulated across pages.
 *
 * OFFSET PAGINATION IS UNSTABLE HERE, and it is worth understanding rather
 * than assuming it works. The list is ordered by updatedAt DESC, so editing a
 * note while paging moves it to the top and shifts everything after it:
 *
 *     notes:            E  D  C  B  A
 *     page 0 (size 2):  E  D
 *       ← user edits B, B jumps to the top
 *     notes now:        B  E  D  C  A
 *     page 1:           D  C           <- D repeated, E SKIPPED
 *
 * The duplicate is visible. The skip is not — the user simply never sees E
 * again and has no reason to suspect it exists.
 *
 * NOT FIXED, for sequencing reasons: decision D2 moves this read path onto
 * Dexie in Step 7, where sync pulls everything and the list pages over a
 * complete local set. Offset instability stops existing, so keyset pagination
 * built now would be work Step 7 deletes. The dedupe below removes the visible
 * half cheaply.
 *
 * (Ties are already handled server-side — B5 routes the list finder through
 * withStableOrder, so equal updatedAt values cannot reorder between pages.)
 */
export function useNotes({ archived = false }: { archived?: boolean } = {}) {
  const [state, setState] = useState<NotesState>({ status: 'loading' });
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  /*
   * Incremented whenever the list RESETS (filter change or reload). A
   * "load more" response captures the generation it started in and discards
   * itself if that has moved on.
   *
   * AbortController cancels the request; this guards the DECISION. An abort
   * that arrives after the response has already resolved would otherwise
   * append archived notes onto the unarchived list.
   */
  const generationRef = useRef(0);

  /** Next page to request. A ref, so loadMore does not need to be recreated. */
  const nextPageRef = useRef(1);

  /*
   * Synchronous re-entry guard. setLoadingMore(true) does not take effect
   * until the next render, so two fast clicks both observe false and both
   * fire — requesting the same page twice and appending it twice.
   */
  const inFlightRef = useRef(false);

  const reload = useCallback(() => {
    setReloadToken((n) => n + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    generationRef.current += 1;
    nextPageRef.current = 1;
    inFlightRef.current = false;

    setState({ status: 'loading' });
    setLoadingMore(false);

    noteService
      .listNotes({ page: 0, size: PAGE_SIZE, archived, signal: controller.signal })
      .then((page) => {
        setState({
          status: 'ready',
          notes: page.content,
          hasNext: page.hasNext,
          total: page.totalElements,
        });
      })
      .catch((error: unknown) => {
        // Expected: the effect cleaned up, or a newer request superseded this.
        // Rendering an error would flash a failure during ordinary navigation.
        if (isAborted(error)) return;
        setState({ status: 'error', message: 'Could not load your notes.' });
      });

    return () => {
      controller.abort();
    };
  }, [archived, reloadToken]);

  const loadMore = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    const generation = generationRef.current;
    const page = nextPageRef.current;

    setLoadingMore(true);
    try {
      const result = await noteService.listNotes({ page, size: PAGE_SIZE, archived });

      // The filter changed or the list reloaded while this was in flight.
      // Appending now would mix two different lists together.
      if (generation !== generationRef.current) return;

      nextPageRef.current = page + 1;

      setState((current) => {
        if (current.status !== 'ready') return current;

        /*
         * DEDUPE BY ID. See the note above: a note edited between pages
         * reappears in the next one. This removes the visible symptom; the
         * skipped note it implies is not recoverable here and is why Step 7
         * exists.
         */
        const seen = new Set(current.notes.map((note) => note.id));
        const appended = result.content.filter((note) => !seen.has(note.id));

        return {
          status: 'ready',
          notes: [...current.notes, ...appended],
          hasNext: result.hasNext,
          total: result.totalElements,
        };
      });
    } catch (error: unknown) {
      if (isAborted(error)) return;
      // The already-loaded notes stay on screen. Replacing a working list with
      // an error because page 3 failed would be a worse outcome than the
      // failure itself.
      setState((current) => (current.status === 'ready' ? current : current));
    } finally {
      inFlightRef.current = false;
      setLoadingMore(false);
    }
  }, [archived]);

  /**
   * Removes a note from the list immediately and returns how to put it back.
   *
   * OPTIMISTIC: the row disappears before the server has confirmed anything,
   * because a delete that waits for a round trip feels broken on a slow
   * connection.
   *
   * The restore closure reinserts at the ORIGINAL INDEX, not at the top.
   * Putting it back somewhere else would silently reorder the user's list as a
   * side effect of an action they cancelled — which is a strange thing for
   * "undo" to do.
   */
  const removeOptimistically = useCallback((noteId: number): (() => void) => {
    let removed: { note: NoteSummaryResponse; index: number } | null = null;

    setState((current) => {
      if (current.status !== 'ready') return current;

      const index = current.notes.findIndex((note) => note.id === noteId);
      if (index === -1) return current;

      const note = current.notes[index];
      if (!note) return current;

      removed = { note, index };
      return {
        ...current,
        notes: current.notes.filter((candidate) => candidate.id !== noteId),
        total: Math.max(0, current.total - 1),
      };
    });

    return () => {
      const snapshot = removed;
      if (!snapshot) return;

      setState((current) => {
        if (current.status !== 'ready') return current;
        // Already back — an undo raced with a reload, and inserting again
        // would duplicate it.
        if (current.notes.some((note) => note.id === noteId)) return current;

        const notes = [...current.notes];
        notes.splice(Math.min(snapshot.index, notes.length), 0, snapshot.note);
        return { ...current, notes, total: current.total + 1 };
      });
    };
  }, []);

  /**
   * Merges changed fields into one row.
   *
   * The B5 obligation lives here: pin and archive bump @Version, so the
   * version this list holds has to move with them or the next edit sends a
   * stale one.
   */
  const applyUpdate = useCallback((noteId: number, changes: Partial<NoteSummaryResponse>) => {
    setState((current) => {
      if (current.status !== 'ready') return current;
      return {
        ...current,
        notes: current.notes.map((note) => (note.id === noteId ? { ...note, ...changes } : note)),
      };
    });
  }, []);

  return { state, loadingMore, loadMore, reload, removeOptimistically, applyUpdate };
}
