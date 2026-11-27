/** Works out a note's status. */
import { SAVING_LOCAL_MS, SYNCED_AFTER_MS } from '@/core/config/timings';
import type { NoteRow } from '@/features/notes/local/noteRow';

export type NoteStatus =
  | 'saving-local'
  | 'saved-local'
  | 'synced'
  | 'offline'
  | 'sync-paused'
  | 'not-saved';

export interface NoteStatusInput {
  row: Pick<NoteRow, 'dirty' | 'syncState' | 'serverId' | 'localUpdatedAt'>;
  now: number;
  online: boolean;
  syncFailing: boolean;
  storageFull: boolean;
  signedOut?: boolean | undefined;
}

export function deriveNoteStatus({
  row,
  now,
  online,
  syncFailing,
  storageFull,
  signedOut = false,
}: NoteStatusInput): NoteStatus {
  if (storageFull) return 'not-saved';

  const age = now - row.localUpdatedAt;
  if (row.dirty === 1 && age < SAVING_LOCAL_MS) return 'saving-local';

  if (signedOut) return 'saved-local';

  const clean = row.dirty === 0 && row.serverId !== null && row.syncState === 'synced';
  if (clean) return age < SYNCED_AFTER_MS ? 'saved-local' : 'synced';

  if (!online) return 'offline';
  if (row.syncState === 'invalid' || syncFailing) return 'sync-paused';
  return 'saved-local';
}
