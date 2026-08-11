import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/app/providers/auth-context';
import { noteService } from '@/features/notes/api/noteService';
import { toView, type NoteView } from '@/features/notes/local/noteMappers';
import { noteRepository } from '@/features/notes/local/noteRepository';
import { isAborted } from '@/lib/http/errors';

const PAGE_SIZE = 100;

/**
 * The owner's notes, read from LOCAL STORAGE.
 *
 * This is decision D1 landing. The UI no longer waits on the network: Dexie is
 * the source of truth, and the fetch below is a background process that writes
 * into it. The two halves do not know about each other — the UI does not await
 * the network, the fetch does not touch React state — and they communicate
 * only through the database.
 *
 * WHAT THIS RETIRES:
 *
 *   Offset pagination instability (5B). The list pages over a complete local
 *   set, so a note edited mid-paging can no longer shift the window and
 *   silently skip another.
 *
 *   Empty screens on failure. If the fetch fails and Dexie has rows, the user
 *   reads their notes. The error is a banner, not the screen.
 *
 * ownerId comes from auth context rather than a prop, unlike the editor's
 * currentUserId (6E). That one was decorative — one adjective in a heading.
 * This is the query's predicate: every read is scoped by owner, so the
 * coupling is the query's actual shape rather than incidental.
 */
export interface NotesState {
  /** Undefined while Dexie is still answering — NOT the same as empty. */
  notes: NoteView[] | undefined;
  /** A background refresh is in flight. Content may already be on screen. */
  refreshing: boolean;
  /** The last refresh failed. Local rows are still shown. */
  refreshError: string | null;
  refresh: () => void;
}

export function useNotes({ archived = false }: { archived?: boolean } = {}): NotesState {
  const { state: authState } = useAuth();
  const ownerId =
    authState.status === 'authenticated' || authState.status === 'refreshing'
      ? authState.user.id
      : null;

  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const refresh = useCallback(() => {
    setRefreshToken((n) => n + 1);
  }, []);

  /*
   * THE READ. Subscribes to a query, not a value.
   *
   * Dexie records which tables and ranges this touched and re-runs it whenever
   * anything writes to them — including another tab. A note saved elsewhere
   * appears here with no code connecting the two, which is the capability that
   * justified choosing Dexie over a thin IndexedDB wrapper (D3).
   *
   * The dependency array works like useEffect's: the query re-runs when these
   * change, and the subscription is torn down on unmount.
   */
  const rows = useLiveQuery(async () => {
    if (ownerId === null) return [];
    return archived ? noteRepository.listArchived(ownerId) : noteRepository.listActive(ownerId);
  }, [ownerId, archived]);

  /*
   * THE REFRESH. Writes into Dexie and returns nothing to React.
   *
   * Note what it does NOT do: set the notes into state. There is one source of
   * truth and this is not it. The write lands in Dexie, useLiveQuery notices,
   * and the list re-renders — the same path a write from another tab takes.
   */
  useEffect(() => {
    if (ownerId === null) return;

    const controller = new AbortController();
    setRefreshing(true);

    noteService
      .listNotes({ page: 0, size: PAGE_SIZE, archived, signal: controller.signal })
      .then(async (page) => {
        await noteRepository.upsertSummaries(page.content, ownerId);
        setRefreshError(null);
      })
      .catch((error: unknown) => {
        // Expected on unmount or when a newer refresh supersedes this one.
        if (isAborted(error)) return;
        /*
         * A message, not an empty screen. Whatever is in Dexie stays on
         * display — offline, from cache, and correct. This inversion is most
         * of what "offline-first" means in practice.
         */
        setRefreshError('Could not reach Notare. Showing notes saved on this device.');
      })
      .finally(() => {
        setRefreshing(false);
      });

    return () => {
      controller.abort();
    };
  }, [ownerId, archived, refreshToken]);

  return {
    notes: rows?.map(toView),
    refreshing,
    refreshError,
    refresh,
  };
}
