import { TRASH_DAYS } from '@/core/config/timings';
import type { NoteRow } from '@/features/notes/local/noteRow';
import { parseServerDateTime } from '@/lib/time';

const DAY_MS = 86_400_000;

/** When a note deleted at `deletedAtMs` leaves the bin, until the server says otherwise. */
export function purgeAtFor(deletedAtMs: number): number {
  return deletedAtMs + TRASH_DAYS * DAY_MS;
}

/**
 * When this note leaves the bin (epoch ms): the stored purgeAt first (the
 * server's, once it sends one), else deletedAt + TRASH_DAYS, else null.
 */
export function purgeAtOf(row: Pick<NoteRow, 'purgeAt' | 'deletedAt'>): number | null {
  if (row.purgeAt !== undefined && row.purgeAt !== null) return row.purgeAt;
  if (row.deletedAt === null) return null;
  const deleted = parseServerDateTime(row.deletedAt);
  return deleted === null ? null : purgeAtFor(deleted.getTime());
}

/** "N days left" for the bin. Null when the note has no purge date. */
export function daysLeft(row: Pick<NoteRow, 'purgeAt' | 'deletedAt'>, now: number): number | null {
  const at = purgeAtOf(row);
  return at === null ? null : Math.max(0, Math.ceil((at - now) / DAY_MS));
}
