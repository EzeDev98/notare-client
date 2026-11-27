import { noteQueries } from '@/features/notes/local/noteQueries';
import { useStableLiveQuery } from '@/shared/hooks/useStableLiveQuery';

export interface DrawerCounts {
  all: number;
  waiting: number;
}

const NONE: DrawerCounts = { all: 0, waiting: 0 };

/**
 * The drawer's counts, read live from Dexie (M-5). They change the moment a
 * note is written, with no fetch and no refresh.
 */
export function useDrawerCounts(ownerId: number): DrawerCounts {
  return useStableLiveQuery(async () => noteQueries.counts(ownerId), [ownerId], NONE);
}
