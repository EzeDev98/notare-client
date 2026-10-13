import { useEffect } from 'react';

import { start } from '@/sync/engine';

/**
 * Starts the sync engine (8F) for one signed-in owner, stops it on
 * unmount/logout.
 *
 * This used to BE the trigger logic (8C/8D's version: mount + `online`, no
 * backoff). It now only calls `engine.start`, which owns triggers, backoff,
 * and the cross-tab lock — this hook's entire remaining job is the one thing
 * a non-React module cannot do for itself: know when React mounted and
 * unmounted it.
 */
/**
 * `paused` (session expired, step 14a) stops the triggers but leaves the outbox
 * alone; turning it off starts the engine again and the queue drains.
 */
export function useSync(ownerId: number | null, paused = false): void {
  useEffect(() => start(paused ? null : ownerId), [ownerId, paused]);
}
