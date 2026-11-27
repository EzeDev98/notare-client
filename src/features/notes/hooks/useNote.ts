/** Reads one note by its server id. */
import { useStableLiveQuery as useLiveQuery } from '@/shared/hooks/useStableLiveQuery';
import { useEffect, useRef, useState } from 'react';

import { api } from '@/core/api';
import { noteRepository } from '@/features/notes/local/noteRepository';
import type { NoteRow } from '@/features/notes/local/noteRow';
import { isAborted, isNotFound } from '@/lib/http/errors';

export function parseNoteId(param: string | undefined): number | null {
  if (param === undefined || param.trim() === '') return null;
  const value = Number(param);
  return Number.isInteger(value) && value > 0 ? value : null;
}

export type NoteState =
  | { status: 'loading' }
  | { status: 'ready'; row: NoteRow }
  | { status: 'not-found' }
  | { status: 'unavailable' };

export function useNote(serverId: number | null): NoteState {
  const [remoteMiss, setRemoteMiss] = useState<'none' | 'not-found' | 'unavailable'>('none');

  const row = useLiveQuery(async () => {
    if (serverId === null) return null;
    return (await noteRepository.getByServerId(serverId)) ?? null;
  }, [serverId]);

  const lastResolvedRef = useRef<NoteRow | null>(null);
  if (row) {
    lastResolvedRef.current = row;
  }
  const previousRowRef = useRef<typeof displayRow>(undefined);

  const displayRow = row === undefined && serverId !== null ? lastResolvedRef.current : row;

  useEffect(() => {
    if (serverId === null) {
      setRemoteMiss('not-found');
      return;
    }

    const controller = new AbortController();
    setRemoteMiss('none');

    api
      .getNote(serverId, { signal: controller.signal })
      .then(async (note) => {
        await noteRepository.upsertFromServer(note);
      })
      .catch((error: unknown) => {
        if (isAborted(error)) return;
        setRemoteMiss(isNotFound(error) ? 'not-found' : 'unavailable');
      });

    return () => {
      controller.abort();
    };
  }, [serverId]);

  if (displayRow === undefined) {
    return previousRowRef.current
      ? { status: 'ready', row: previousRowRef.current }
      : { status: 'loading' };
  }

  previousRowRef.current = displayRow;

  if (displayRow !== null) return { status: 'ready', row: displayRow };

  if (remoteMiss === 'not-found') return { status: 'not-found' };
  if (remoteMiss === 'unavailable') return { status: 'unavailable' };

  return { status: 'loading' };
}
