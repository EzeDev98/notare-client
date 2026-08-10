import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';

import { noteService } from '@/features/notes/api/noteService';
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

    noteService
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

  // Dexie still answering.
  if (row === undefined) return { status: 'loading' };

  // Local copy wins, even if the fetch failed. This is the whole point.
  if (row !== null) return { status: 'ready', row };

  if (remoteMiss === 'not-found') return { status: 'not-found' };
  if (remoteMiss === 'unavailable') return { status: 'unavailable' };

  return { status: 'loading' };
}
