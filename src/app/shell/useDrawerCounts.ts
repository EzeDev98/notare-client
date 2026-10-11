import type { NotesView } from '@/app/routes';
import { noteQueries } from '@/features/notes/local/noteQueries';
import { sharedRepository } from '@/features/notes/local/sharedRepository';
import { useStableLiveQuery } from '@/shared/hooks/useStableLiveQuery';

export type DrawerCounts = Record<NotesView, number> & { waiting: number };

const NONE: DrawerCounts = { all: 0, shared: 0, archived: 0, deleted: 0, waiting: 0 };

/**
 * The drawer's counts, read live from Dexie (M-5). They change the moment a
 * note is written, with no fetch and no refresh.
 */
export function useDrawerCounts(ownerId: number): DrawerCounts {
  return useStableLiveQuery(
    async () => {
      const [mine, shared] = await Promise.all([
        noteQueries.counts(ownerId),
        sharedRepository.count(),
      ]);
      return { ...mine, shared };
    },
    [ownerId],
    NONE,
  );
}
