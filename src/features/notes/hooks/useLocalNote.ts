/** Reads one note from the device. */
import { useStableLiveQuery as useLiveQuery } from '@/shared/hooks/useStableLiveQuery';
import { useRef } from 'react';

import { draftRow } from '@/features/notes/createNote';
import { noteRepository } from '@/features/notes/local/noteRepository';
import type { NoteRow } from '@/features/notes/local/noteRow';

export type LocalNoteState =
  | { status: 'loading' }
  | { status: 'ready'; row: NoteRow }
  | { status: 'not-found' };

export function useLocalNote(localId: string | undefined): LocalNoteState {
  const row = useLiveQuery(async () => {
    if (localId === undefined || localId.trim() === '') return null;
    return (await noteRepository.getByLocalId(localId)) ?? draftRow(localId) ?? null;
  }, [localId]);

  const hasResolvedRef = useRef(false);
  const lastResolvedRef = useRef<NoteRow | null>(null);
  if (row !== undefined) {
    hasResolvedRef.current = true;
    lastResolvedRef.current = row;
  }

  const hasId = localId !== undefined && localId.trim() !== '';

  const displayRow =
    row === undefined ? (hasResolvedRef.current ? lastResolvedRef.current : undefined) : row;

  if (!hasId) {
    return { status: 'not-found' };
  }

  if (displayRow === undefined) {
    return { status: 'loading' };
  }

  if (displayRow === null) {
    return { status: 'not-found' };
  }

  lastResolvedRef.current = displayRow;

  return { status: 'ready', row: displayRow };
}
