import { useEffect, useRef, useState } from 'react';

import { noteService } from '@/features/notes/api/noteService';
import type { NoteSummaryResponse } from '@/features/notes/types';
import { isAborted } from '@/lib/http/errors';

const PAGE_SIZE = 20;

export type SearchState =
  /** No term yet — prompt rather than an empty result set. */
  | { status: 'idle' }
  | { status: 'searching'; previous: NoteSummaryResponse[] }
  | { status: 'ready'; results: NoteSummaryResponse[]; total: number; term: string }
  | { status: 'error'; message: string };

/**
 * Searches notes for an already-debounced term.
 *
 * DEBOUNCE AND ORDERING ARE DIFFERENT PROBLEMS, and this hook only solves the
 * second. Debouncing (the caller's job) reduces how MANY requests are made;
 * nothing about it guarantees they RETURN in order.
 *
 * Type "no", pause, type "te" and two requests exist. If "no" is slow and
 * "note" is fast, the results for "no" land last and the screen shows results
 * that do not match what is in the box.
 *
 * Two mechanisms, and both are needed:
 *
 *   AbortController — cancels the outstanding request when a new term
 *   arrives. Handles most cases and CANNOT handle all of them: abort() on a
 *   promise that has already resolved does nothing, so there is a window where
 *   the stale response is already queued.
 *
 *   Generation counter — captured when the request starts, checked when it
 *   returns. Closes that window by discarding the result rather than trying to
 *   prevent it.
 *
 * Step 6's auto-save faces the same race in a harder form: there, a stale
 * response does not merely show wrong results, it overwrites the user's text.
 */
export function useNoteSearch(term: string) {
  const [state, setState] = useState<SearchState>({ status: 'idle' });
  const generationRef = useRef(0);

  useEffect(() => {
    const trimmed = term.trim();

    if (trimmed === '') {
      /*
       * No request for an empty term. The server treats a blank `query` as
       * "match everything" for notes — technically valid, and dumping the
       * entire note list into a search screen is not what an empty search box
       * means.
       */
      setState({ status: 'idle' });
      return;
    }

    const controller = new AbortController();
    generationRef.current += 1;
    const generation = generationRef.current;

    // Keeps the previous results visible. Clearing to a spinner on every
    // keystroke makes the screen strobe, and the old results are still
    // relevant to what is being typed.
    setState((current) => ({
      status: 'searching',
      previous: current.status === 'ready' ? current.results : [],
    }));

    noteService
      .searchNotes(trimmed, { page: 0, size: PAGE_SIZE, signal: controller.signal })
      .then((page) => {
        // The term moved on while this was in flight. The abort below may not
        // have caught it — a resolved promise cannot be un-resolved.
        if (generation !== generationRef.current) return;

        setState({
          status: 'ready',
          results: page.content,
          total: page.totalElements,
          term: trimmed,
        });
      })
      .catch((error: unknown) => {
        if (generation !== generationRef.current) return;
        if (isAborted(error)) return;
        setState({ status: 'error', message: 'Could not search your notes.' });
      });

    return () => {
      controller.abort();
    };
  }, [term]);

  return state;
}
