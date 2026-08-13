import { useEffect } from 'react';

import { pullChanges } from '@/sync/pull';
import { pushOutbox } from '@/sync/push';

/**
 * Owns WHEN a sync run happens; `push.ts` and `pull.ts` own what happens
 * once one starts.
 *
 * PUSH THEN PULL, always in that order and always sequenced (`await`, not
 * `Promise.all`) — the server needs our writes before we ask what changed,
 * or a pull can hand back a note we're about to overwrite and manufacture a
 * conflict with nobody but ourselves (architecture doc §3.8).
 *
 * Still deliberately minimal, same scope as the 8C version it replaces: run
 * on mount and on the browser's `online` event, no backoff, no polling.
 * "Online/offline transitions, retry with backoff, visible sync status" is
 * 8F's job, not this one's.
 *
 * `ownerId` is read from auth context HERE, at the one point in this
 * subsystem that is allowed to know React exists, and passed down as a
 * plain argument — `pull.ts` stays exactly as ignorant of `useAuth` as
 * `push.ts` already is.
 */
export function useSync(ownerId: number | null): void {
  useEffect(() => {
    function trigger(): void {
      pushOutbox()
        .then(() => pullChanges(ownerId))
        .catch((error: unknown) => {
          // A failure here is never the user's local edits at risk — the
          // outbox and the cursor are both durable in Dexie regardless of
          // whether this run succeeds, and the next trigger (the next
          // 'online' event, or the next mount) picks up from where this one
          // left off.
          console.error('[sync] run failed', error);
        });
    }

    trigger();

    window.addEventListener('online', trigger);
    return () => {
      window.removeEventListener('online', trigger);
    };
  }, [ownerId]);
}
