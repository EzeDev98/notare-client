import { useLiveQuery } from 'dexie-react-hooks';
import { useRef } from 'react';

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
    return (await noteRepository.getByLocalId(localId)) ?? null;
  }, [localId]);

  /*
   * Same Step 5A fix as useNote.ts: hold the outgoing note's row while
   * Dexie re-subscribes for the new localId, instead of dropping through
   * 'loading' (spinner) on every switch between not-yet-synced notes.
   */
  const lastResolvedRef = useRef<NoteRow | null>(null);
  if (row) {
    lastResolvedRef.current = row;
  }

  const hasId = localId !== undefined && localId.trim() !== '';

  const displayRow =
    row === undefined || row === null
      ? lastResolvedRef.current
      : row;

  if (!hasId) {
    return { status: 'not-found' };
  }

  /*
   * Never replace an already-mounted editor with a loading state while
   * navigating between local notes.
   *
   * A local note has already been persisted to Dexie before navigation,
   * so a transient undefined/null result is a query lifecycle event, not
   * evidence that the note does not exist.
   */
  if (displayRow === undefined || displayRow === null) {
    return { status: 'loading' };
  }

  lastResolvedRef.current = displayRow;

  return { status: 'ready', row: displayRow };
}
