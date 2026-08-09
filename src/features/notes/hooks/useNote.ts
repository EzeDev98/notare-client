import { useCallback, useEffect, useState } from 'react';

import { noteService } from '@/features/notes/api/noteService';
import type { NoteResponse } from '@/features/notes/types';
import { isAborted, isNotFound } from '@/lib/http/errors';

export type NoteState =
  | { status: 'loading' }
  | { status: 'ready'; note: NoteResponse }
  /**
   * The server answers 404 for "no such note" AND for "not yours" — the two
   * are conflated on purpose, since a distinct 403 would confirm that a note
   * with that id exists. One state, because we genuinely cannot tell.
   */
  | { status: 'not-found' }
  | { status: 'error'; message: string };

/**
 * Turns a route parameter into a note id, or null.
 *
 * Number, not parseInt: parseInt('12abc') returns 12, silently accepting junk
 * and requesting a note the user never asked for. Number('12abc') is NaN.
 *
 * The isInteger and > 0 checks matter too — Number('') is 0, which would
 * otherwise sail through as a plausible id and produce a confusing server
 * error instead of a local not-found.
 */
export function parseNoteId(param: string | undefined): number | null {
  if (param === undefined || param.trim() === '') return null;
  const value = Number(param);
  return Number.isInteger(value) && value > 0 ? value : null;
}

export function useNote(noteId: number | null) {
  const [state, setState] = useState<NoteState>(
    noteId === null ? { status: 'not-found' } : { status: 'loading' },
  );
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    setReloadToken((n) => n + 1);
  }, []);

  useEffect(() => {
    if (noteId === null) {
      // An unparseable URL never becomes a request. /notes/abc should be a
      // local not-found, not a server error.
      setState({ status: 'not-found' });
      return;
    }

    const controller = new AbortController();
    console.log('[useNote] fetching', noteId);
    setState({ status: 'loading' });

    noteService
      .getNote(noteId, { signal: controller.signal })
      .then((note) => {
        setState({ status: 'ready', note });
      })
      .catch((error: unknown) => {
        // Expected — navigating away, or a newer request superseding this one.
        if (isAborted(error)) return;
        setState(
          isNotFound(error)
            ? { status: 'not-found' }
            : { status: 'error', message: 'Could not load this note.' },
        );
      });

    return () => {
      controller.abort();
    };
  }, [noteId, reloadToken]);

  return { state, reload };
}
