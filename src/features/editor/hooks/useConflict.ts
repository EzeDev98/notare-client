import { useEffect, useState } from 'react';

import { noteService } from '@/features/notes/api/noteService';
import type { NoteResponse } from '@/features/notes/types';
import { isAborted } from '@/lib/http/errors';

export type ConflictState =
  | { status: 'none' }
  | { status: 'loading' }
  | { status: 'ready'; theirs: NoteResponse }
  | { status: 'error' };

/**
 * Fetches the server's copy once a conflict is detected.
 *
 * A REFETCH IS REQUIRED, and the architecture doc was wrong about this. It
 * said the backend returns the server's note in the conflict payload — true of
 * /sync/batch, where SyncOperationResult carries a `note`, and NOT true of the
 * editor's PATCH. GlobalExceptionHandler returns a ProblemDetail with
 * currentVersion at the root and nothing else.
 *
 * We refetch unconditionally rather than branching on whether currentVersion
 * was present. The bare flavour (ObjectOptimisticLockingFailureException
 * carries no version at all) only appears under genuine concurrency, so a
 * branch for it would be the least-exercised code in the editor — and this is
 * one GET, at a moment when the user has already stopped to read something.
 */
export function useConflict(noteId: number | null, active: boolean): ConflictState {
  const [state, setState] = useState<ConflictState>({ status: 'none' });

  useEffect(() => {
    if (!active || noteId === null) {
      setState({ status: 'none' });
      return;
    }

    const controller = new AbortController();
    setState({ status: 'loading' });

    noteService
      .getNote(noteId, { signal: controller.signal })
      .then((theirs) => {
        setState({ status: 'ready', theirs });
      })
      .catch((error: unknown) => {
        if (isAborted(error)) return;
        setState({ status: 'error' });
      });

    return () => {
      controller.abort();
    };
  }, [noteId, active]);

  return state;
}
