import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback } from 'react';

import { useToast } from '@/app/providers/toast-context';
import { toView, type NoteView } from '@/features/notes/local/noteMappers';
import { noteRepository } from '@/features/notes/local/noteRepository';
import type { NoteRow } from '@/features/notes/local/noteRow';
import { resolveKeepBoth, resolveKeepMine, resolveUseTheirs } from '@/sync/conflicts';

/**
 * One conflicted row, with both sides the screen needs — the local
 * `NoteView` plus the server's note captured at the moment push.ts or
 * reconcile.ts discovered the conflict (`conflictNote`, noteRow.ts).
 *
 * Not folded into `NoteView` itself: this shape only exists for this
 * screen, and forcing every other reader of `NoteView` to carry a nullable
 * `conflictNote` it never uses would be the same encoding-leak
 * noteMappers.ts's own doc comment warns callers away from.
 */
export interface ConflictItem {
  note: NoteView;
  theirs: NonNullable<NoteRow['conflictNote']>;
}

export interface ConflictsState {
  /** Undefined while Dexie is still answering — NOT the same as no conflicts. */
  conflicts: ConflictItem[] | undefined;
  keepMine: (localId: string) => Promise<void>;
  /**
   * Named `takeTheirs`, not `useTheirs` — a plain callback whose name
   * happens to match `use[A-Z]` reads as a Hook to eslint-plugin-react-hooks'
   * naming heuristic, and this file previously lived under `sync/` with that
   * exact name, which is what tripped `react-hooks/rules-of-hooks` the
   * moment a page called it from inside an `onClick`. The rename is the fix,
   * not a suppression.
   */
  takeTheirs: (localId: string) => Promise<void>;
  keepBoth: (localId: string) => Promise<void>;
}

/**
 * Moved here from `sync/useConflicts.ts` — `sync/` may not import
 * `@/app/**` ("sync/ has no UI. Expose state for React to subscribe to
 * instead," eslint.config's own message), and this hook needs
 * `useToast`. `features/notes/hooks/` is exactly where `useNoteActions` and
 * `useTrash` already sit for the identical reason: a feature-level hook is
 * the allowed seam between a page and the lower layers (`sync/conflicts.ts`
 * here, same as `noteRepository`/`noteService` for those two).
 *
 * `sync/conflicts.ts` itself did NOT move — `resolveKeepMine` /
 * `resolveUseTheirs` / `resolveKeepBoth` have no UI dependency and stay
 * exactly where the engine lives. Only the toast-wiring wrapper belongs up
 * here.
 *
 * Reads local storage the same way `useTrash` and `useNotes` do — Dexie is
 * the source of truth, and `ownerId` is a parameter for the same reason it
 * is everywhere else in this file's siblings: this hook is a screen
 * concern, not a subsystem one.
 */
export function useConflicts(ownerId: number | null): ConflictsState {
  const toast = useToast();

  const rows = useLiveQuery(async () => {
    if (ownerId === null) return [];
    return noteRepository.listConflicted(ownerId);
  }, [ownerId]);

  const conflicts = rows
    ?.filter((row): row is NoteRow & { conflictNote: NonNullable<NoteRow['conflictNote']> } =>
      row.conflictNote !== null,
    )
    .map((row) => ({ note: toView(row), theirs: row.conflictNote }));

  const keepMine = useCallback(
    async (localId: string) => {
      await resolveKeepMine(localId);
      toast.show({ message: 'Kept your version.' });
    },
    [toast],
  );

  const takeTheirs = useCallback(
    async (localId: string) => {
      await resolveUseTheirs(localId);
      toast.show({ message: 'Replaced with the other version.' });
    },
    [toast],
  );

  const keepBoth = useCallback(
    async (localId: string) => {
      await resolveKeepBoth(localId);
      toast.show({ message: 'Kept both versions.' });
    },
    [toast],
  );

  return { conflicts, keepMine, takeTheirs, keepBoth };
}
