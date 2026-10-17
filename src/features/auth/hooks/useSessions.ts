import { useCallback, useEffect, useState } from 'react';

import { authService } from '@/features/auth/api/authService';
import type { SessionResponse } from '@/features/auth/types';
import { isAborted } from '@/lib/http/errors';

/**
 * Loads the user's sessions.
 *
 * A HAND-ROLLED fetch hook, and worth noticing what it costs: no cache, no
 * deduplication, no background refetch, no retry, and the loading/error state
 * written out by hand. Every screen that fetches will want the same things and
 * will get a slightly different version of them.
 *
 * That is the argument for TanStack Query, which arrives in 9A for exactly the
 * online-only domains this belongs to. Introducing it here would mean adopting
 * a library before feeling the problem it solves — so this stays as it is, and
 * 9A replaces it with the reason visible.
 *
 * The one thing it does get right is cancellation: an AbortController tied to
 * the effect's cleanup, so a response arriving after unmount does not call
 * setState on a component that no longer exists.
 */
export function useSessions() {
  const [sessions, setSessions] = useState<SessionResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    setReloadToken((n) => n + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    authService
      .listSessions({ signal: controller.signal })
      .then((result) => {
        setSessions(result);
        setError(null);
      })
      .catch((cause: unknown) => {
        // An aborted request is expected — the component unmounted or a reload
        // superseded it. Surfacing it as an error would be the bug.
        if (isAborted(cause)) return;
        setError('Could not load your devices.');
      });

    return () => {
      controller.abort();
    };
  }, [reloadToken]);

  const revoke = useCallback(async (sessionId: string): Promise<void> => {
    await authService.revokeSession(sessionId);
    // Optimistic removal: the row is gone from the server, so waiting for a
    // refetch just makes the UI feel slow.
    setSessions((current) => current?.filter((s) => s.sessionId !== sessionId) ?? null);
  }, []);

  const revokeAll = useCallback(() => authService.logoutAll(), []);

  return { sessions, error, reload, revoke, revokeAll };
}
