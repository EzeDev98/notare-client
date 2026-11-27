/** The drawer's note counts, read live from the device. */
import { noteQueries } from '@/features/notes/local/noteQueries';
import { useStableLiveQuery } from '@/shared/hooks/useStableLiveQuery';

export interface DrawerCounts {
  all: number;
  waiting: number;
}

const NONE: DrawerCounts = { all: 0, waiting: 0 };

export function useDrawerCounts(ownerId: number): DrawerCounts {
  return useStableLiveQuery(async () => noteQueries.counts(ownerId), [ownerId], NONE);
}
