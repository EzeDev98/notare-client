import { useLiveQuery } from 'dexie-react-hooks';

import { noteRepository } from '@/features/notes/local/noteRepository';

/**
 * Count only. The full interactive hook (resolutions, toasts) moved to
 * `@/features/notes/hooks/useConflicts` — this file may not import
 * `@/app/**` ("sync/ has no UI. Expose state for React to subscribe to
 * instead," eslint.config's own restriction), and the toast-wiring version
 * needed exactly that.
 *
 * This one stays here because `AppLayout.tsx` is its only caller, and
 * `AppLayout` sits outside the globs the "components must not drive the
 * sync engine" lint rule actually restricts (`src/pages` and each
 * feature's own `components` directory) — so importing `sync/` directly
 * from the shell is still the correct layer for it, same as
 * `useSync`/`useSyncStatus` already are.
 */
export function useConflictCount(ownerId: number | null): number {
  const count = useLiveQuery(async () => {
    if (ownerId === null) return 0;
    return (await noteRepository.listConflicted(ownerId)).length;
  }, [ownerId]);

  return count ?? 0;
}
