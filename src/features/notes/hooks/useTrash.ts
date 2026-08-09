import { useCallback, useEffect, useState } from 'react';

import { useToast } from '@/app/providers/toast-context';
import { noteService } from '@/features/notes/api/noteService';
import type { TrashedNoteResponse } from '@/features/notes/types';
import { isAborted } from '@/lib/http/errors';

export type TrashState =
  | { status: 'loading' }
  | { status: 'ready'; notes: TrashedNoteResponse[] }
  | { status: 'error'; message: string };

/**
 * The trash (B4).
 *
 * Restore and permanent delete existed from Step 1 and nothing could list what
 * they operated on, so a soft delete was indistinguishable from a permanent
 * one — this is the screen that closed that.
 */
export function useTrash() {
  const [state, setState] = useState<TrashState>({ status: 'loading' });
  const [reloadToken, setReloadToken] = useState(0);
  const toast = useToast();

  const reload = useCallback(() => {
    setReloadToken((n) => n + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });

    noteService
      .listTrash({ signal: controller.signal })
      .then((page) => {
        setState({ status: 'ready', notes: page.content });
      })
      .catch((error: unknown) => {
        if (isAborted(error)) return;
        setState({ status: 'error', message: 'Could not load your trash.' });
      });

    return () => {
      controller.abort();
    };
  }, [reloadToken]);

  const remove = useCallback((noteId: number) => {
    setState((current) =>
      current.status === 'ready'
        ? { ...current, notes: current.notes.filter((row) => row.note.id !== noteId) }
        : current,
    );
  }, []);

  const restore = useCallback(
    async (noteId: number) => {
      remove(noteId);
      try {
        await noteService.restoreNote(noteId);
        toast.show({ message: 'Note restored.' });
      } catch {
        toast.show({ message: 'Could not restore that note.' });
        reload();
      }
    },
    [remove, reload, toast],
  );

  const deleteForever = useCallback(
    async (noteId: number) => {
      remove(noteId);
      try {
        await noteService.permanentlyDeleteNote(noteId);
        // NO undo offered, because there is none. Any affordance suggesting
        // otherwise would be a lie.
        toast.show({ message: 'Note deleted permanently.' });
      } catch {
        toast.show({ message: 'Could not delete that note.' });
        reload();
      }
    },
    [remove, reload, toast],
  );

  return { state, reload, restore, deleteForever };
}
