import { useLiveQuery } from 'dexie-react-hooks';

import { useAuth } from '@/app/providers/auth-context';
import { toView, type NoteView } from '@/features/notes/local/noteMappers';
import { noteRepository } from '@/features/notes/local/noteRepository';

export type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; results: NoteView[]; total: number; term: string };

/**
 * Searches notes locally. (7G)
 *
 * The previous version of this hook was almost entirely about a problem that
 * no longer exists: a term typed, a request sent, and a SECOND term typed
 * before the first request returned. That required an AbortController and a
 * generation counter, because two network responses can come back in either
 * order.
 *
 * A Dexie query has no "in flight" to race. `useLiveQuery` re-runs
 * synchronously against the local table and there is nothing to arrive out of
 * order — the machinery that guarded against it is gone because the failure
 * mode it guarded against is gone, not because it was simplified.
 *
 * `status: 'loading'` is the one state worth keeping distinct from 'ready':
 * dexie-react-hooks keeps returning the PREVIOUS result while a query
 * re-runs, so it only ever shows `undefined` before the very first query for
 * this hook instance resolves — which happens when a term arrives already in
 * the URL (a shared or bookmarked `/search?q=...` link) rather than typed.
 */
export function useNoteSearch(term: string): SearchState {
  const { state: authState } = useAuth();
  const ownerId =
    authState.status === 'authenticated' || authState.status === 'refreshing'
      ? authState.user.id
      : null;

  const trimmed = term.trim();

  const rows = useLiveQuery(async () => {
    if (ownerId === null || trimmed === '') return [];
    return noteRepository.search(trimmed, ownerId);
  }, [ownerId, trimmed]);

  if (trimmed === '') {
    return { status: 'idle' };
  }

  if (rows === undefined) {
    return { status: 'loading' };
  }

  const results = rows.map(toView);
  return { status: 'ready', results, total: results.length, term: trimmed };
}
