import { SAVING_LOCAL_MS, SYNCED_AFTER_MS } from '@/core/config/timings';
import type { NoteRow } from '@/features/notes/local/noteRow';

/**
 * The one answer to "is my note safe?" (step 8h, A-06).
 *
 * Exactly these seven. The words for them are in noteStatusContent.ts.
 */
export type NoteStatus =
  'saving-local' | 'saved-local' | 'synced' | 'offline' | 'sync-paused' | 'not-saved' | 'view-only';

export interface NoteStatusInput {
  row: Pick<NoteRow, 'role' | 'dirty' | 'syncState' | 'serverId' | 'localUpdatedAt'>;
  /** Epoch ms. A parameter so the rule stays pure and testable. */
  now: number;
  /** navigator.onLine. */
  online: boolean;
  /** The sync engine is failing: a server error, or a failed run while the browser says online. */
  syncFailing: boolean;
  /** A write to this device failed because storage is full. */
  storageFull: boolean;
}

/**
 * Derived from the row's dirty and syncState, whether the browser is online,
 * the sync engine's failure state, and the storage-full flag. Nothing else.
 *
 * "Synced" is claimed only for a note the server has (serverId) with nothing
 * waiting to be sent (D-05).
 */
export function deriveNoteStatus({
  row,
  now,
  online,
  syncFailing,
  storageFull,
}: NoteStatusInput): NoteStatus {
  if (row.role === 'viewer') return 'view-only';
  if (storageFull) return 'not-saved';

  const age = now - row.localUpdatedAt;
  if (row.dirty === 1 && age < SAVING_LOCAL_MS) return 'saving-local';

  const clean = row.dirty === 0 && row.serverId !== null && row.syncState === 'synced';
  if (clean) return age < SYNCED_AFTER_MS ? 'saved-local' : 'synced';

  if (!online) return 'offline';
  if (row.syncState === 'invalid' || syncFailing) return 'sync-paused';
  return 'saved-local';
}
