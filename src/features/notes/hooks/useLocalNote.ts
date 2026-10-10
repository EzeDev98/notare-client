import { useStableLiveQuery as useLiveQuery } from '@/shared/hooks/useStableLiveQuery';
import { useRef } from 'react';

import { draftRow } from '@/features/notes/createNote';
import { noteRepository } from '@/features/notes/local/noteRepository';
import type { NoteRow } from '@/features/notes/local/noteRow';

export type LocalNoteState =
  /** Dexie has not answered yet. */
  | { status: 'loading' }
  | { status: 'ready'; row: NoteRow }
  /** No such row on this device — including a missing/blank route param. */
  | { status: 'not-found' };

/**
 * One note, read from local storage ONLY, by the id WE generated.
 *
 * The server counterpart is useNote(serverId) — deliberately not reused here.
 * That hook's whole second half is a fetch keyed on a NUMERIC server id, used
 * to fill Dexie for a note this device has never seen. A localId is neither
 * numeric nor something the server has ever heard of, so there is no fetch
 * for this hook to make: a row absent from Dexie is simply not-found, full
 * stop. No 'unavailable' state either, for the same reason — that state
 * exists to distinguish "the server says no" from "the server is
 * unreachable", and this hook never asks the server anything.
 */
export function useLocalNote(localId: string | undefined): LocalNoteState {
  const row = useLiveQuery(async () => {
    if (localId === undefined || localId.trim() === '') return null;
    // A new note is only in memory until the person types (createNote.ts).
    return (await noteRepository.getByLocalId(localId)) ?? draftRow(localId) ?? null;
  }, [localId]);

  /*
   * Same Step 5A fix as useNote.ts: hold the outgoing note's row while
   * Dexie re-subscribes for the new localId, instead of dropping through
   * 'loading' (spinner) on every switch between not-yet-synced notes.
   *
   * `hasResolvedRef` is what makes that safe. `lastResolvedRef.current`
   * starts at `null` — the same value a query that HAS run and genuinely
   * found nothing settles on — so on a component's very first render (mount,
   * or remount after a route-definition change; see NoteEditorHost's own
   * note on why local <-> server note switches remount rather than update
   * in place) there was no way to tell "nothing resolved yet" apart from
   * "confirmed not found." Substituting the ref unconditionally turned the
   * former into the latter, which is what put a real "Note not found" flash
   * on screen for a fresh mount that was still waiting on Dexie's first
   * answer. `hasResolvedRef` only flips once a query has actually settled at
   * least once, so a fresh mount now correctly reports `loading` (renders
   * nothing) until then.
   */
  const hasResolvedRef = useRef(false);
  const lastResolvedRef = useRef<NoteRow | null>(null);
  if (row !== undefined) {
    hasResolvedRef.current = true;
    lastResolvedRef.current = row;
  }

  const hasId = localId !== undefined && localId.trim() !== '';

  /*
   * Only `undefined` means "Dexie hasn't answered yet" — either the very
   * first query on this hook instance, or useLiveQuery's transient state
   * while resubscribing for a new localId once at least one query has
   * already settled. `null` means a query settled and found nothing, which
   * is a real answer, not a gap to paper over with the previous note.
   */
  const displayRow =
    row === undefined ? (hasResolvedRef.current ? lastResolvedRef.current : undefined) : row;

  if (!hasId) {
    return { status: 'not-found' };
  }

  /*
   * Never replace an already-mounted editor with a loading state while
   * navigating between local notes.
   *
   * A local note has already been persisted to Dexie before navigation,
   * so a transient undefined result is a query lifecycle event, not
   * evidence that the note does not exist.
   */
  if (displayRow === undefined) {
    return { status: 'loading' };
  }

  if (displayRow === null) {
    return { status: 'not-found' };
  }

  lastResolvedRef.current = displayRow;

  return { status: 'ready', row: displayRow };
}
