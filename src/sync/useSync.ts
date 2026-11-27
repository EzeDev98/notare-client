/** Starts sync for one signed-in person. */
import { useEffect } from 'react';

import { start } from '@/sync/engine';

export function useSync(ownerId: number | null, paused = false): void {
  useEffect(() => start(paused ? null : ownerId), [ownerId, paused]);
}
