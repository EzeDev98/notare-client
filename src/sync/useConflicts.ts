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
  useTheirs: (localId: string) => Promise<void>;
  keepBoth: (localId: string) => Promise<void>;
}

/**
 * Reads local storage the same way `useTrash` and `useNotes` do — Dexie is
 * the source of truth, and `ownerId` is a parameter because this hook is a
 * screen concern, not a subsystem one; `conflicts.ts` itself stays as
 * ignorant of React as `push.ts` and `pull.ts` are.
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

  const useTheirs = useCallback(
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

  return { conflicts, keepMine, useTheirs, keepBoth };
}

/**
 * Count only — for the AppLayout banner, which needs to know WHETHER to
 * show itself on every route without pulling in the resolution API or
 * re-rendering on every field of every conflicted note along the way.
 */
export function useConflictCount(ownerId: number | null): number {
  const count = useLiveQuery(async () => {
    if (ownerId === null) return 0;
    return (await noteRepository.listConflicted(ownerId)).length;
  }, [ownerId]);

  return count ?? 0;
}
