import { useStableLiveQuery as useLiveQuery } from '@/shared/hooks/useStableLiveQuery';
import { useEffect, useRef, useState } from 'react';

import { api } from '@/core/api';
import { noteRepository } from '@/features/notes/local/noteRepository';
import type { NoteRow } from '@/features/notes/local/noteRow';
import { isAborted, isNotFound } from '@/lib/http/errors';

/**
 * Turns a route parameter into a note id, or null.
 *
 * Number, not parseInt: parseInt('12abc') returns 12 and fetches a note nobody
 * asked for. Number('') is 0, which would otherwise pass as a plausible id.
 */
export function parseNoteId(param: string | undefined): number | null {
  if (param === undefined || param.trim() === '') return null;
  const value = Number(param);
  return Number.isInteger(value) && value > 0 ? value : null;
}

export type NoteState =
  /** Dexie has not answered yet. Milliseconds; usually renders nothing. */
  | { status: 'loading' }
  | { status: 'ready'; row: NoteRow }
  /** Not in Dexie, and the server says it does not exist or is not ours. */
  | { status: 'not-found' }
  /** Not in Dexie and the server is unreachable — different from not-found. */
  | { status: 'unavailable' };

/**
 * One note, read from local storage.
 *
 * The offline case is the interesting one, and it is why 'not-found' and
 * 'unavailable' are separate states. A note absent from Dexie with the server
 * unreachable is NOT missing — we simply cannot tell. Saying "this note does
 * not exist" would be a confident claim about something we have no way to
 * check, and the user would reasonably conclude they had lost it.
 */
export function useNote(serverId: number | null): NoteState {
  const [remoteMiss, setRemoteMiss] = useState<'none' | 'not-found' | 'unavailable'>('none');

  const row = useLiveQuery(async () => {
    if (serverId === null) return null;
    return (await noteRepository.getByServerId(serverId)) ?? null;
  }, [serverId]);

  /*
   * Step 5A fix. dexie-react-hooks resets `row` to `undefined` the instant
   * `serverId` changes, before the new subscription's first emission — the
   * confirmed bug from Step 1D. Left alone, that means every note switch
   * drops through `status: 'loading'` for a tick: the editor collapses to a
   * bare spinner and then pops back in, stacked on top of the remount
   * NoteEditorHost's own `key` already does. That double collapse/expand is
   * the visible "jump."
   *
   * Fix: keep serving the OUTGOING note's row while the new query is still
   * in flight, instead of showing nothing in between. Only falls back while
   * `serverId` is a real id (a genuine note-to-note switch) — a route with
   * no note at all (serverId === null) still resolves the ordinary way.
   * Dexie reads are local and fast, so the stale frame is imperceptible;
   * what it removes is the spinner-collapse entirely.
   */
  const lastResolvedRef = useRef<NoteRow | null>(null);
  if (row) {
    lastResolvedRef.current = row;
  }
  const previousRowRef = useRef<typeof displayRow>(undefined);

  const displayRow = row === undefined && serverId !== null ? lastResolvedRef.current : row;

  /*
   * Fetch only to FILL Dexie — a note opened from a deep link, or one the list
   * has never loaded. The result is written to the database and read back
   * through the live query above rather than being returned here.
   */
  useEffect(() => {
    if (serverId === null) {
      setRemoteMiss('not-found');
      return;
    }

    const controller = new AbortController();
    setRemoteMiss('none');

    api
      .getNote(serverId, { signal: controller.signal })
      .then(async (note) => {
        // 'skipped' when the local row has unsent edits — the repository
        // refuses to overwrite them, and 7F decides what that means.
        await noteRepository.upsertFromServer(note);
      })
      .catch((error: unknown) => {
        if (isAborted(error)) return;
        setRemoteMiss(isNotFound(error) ? 'not-found' : 'unavailable');
      });

    return () => {
      controller.abort();
    };
  }, [serverId]);

  // Dexie still answering, and nothing usable to show meanwhile.
  /*
   * A note switch can produce one render where the repository has
   * not exposed the newly selected row yet. Do NOT turn that
   * transient gap into a page-level loading state.
   *
   * The detail editor must remain mounted while the next row
   * resolves. A real missing note is handled by the caller once
   * the repository has settled; this branch is specifically for
   * the transient switch gap.
   */
  if (displayRow === undefined) {
    return previousRowRef.current
      ? { status: 'ready', row: previousRowRef.current }
      : { status: 'loading' };
  }

  previousRowRef.current = displayRow;

  // Local copy wins, even if the fetch failed. This is the whole point.
  if (displayRow !== null) return { status: 'ready', row: displayRow };

  if (remoteMiss === 'not-found') return { status: 'not-found' };
  if (remoteMiss === 'unavailable') return { status: 'unavailable' };

  return { status: 'loading' };
}
