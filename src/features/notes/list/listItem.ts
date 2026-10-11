import { ROUTES } from '@/app/routes';
import { deriveNoteLabel } from '@/features/notes/local/noteLabel';
import type { NoteRole, NoteRow } from '@/features/notes/local/noteRow';
import type { SharedRow } from '@/features/notes/local/sharedRow';
import { canPin } from '@/features/notes/permissions';
import { parseServerDateTime } from '@/lib/time';

/** What one list row needs, and nothing more. Small on purpose: it is compared on every database change. */
export interface ListItem {
  id: string;
  title: string;
  preview: string;
  /** Epoch ms: when the note was last touched. Orders the list and picks the group. */
  at: number;
  pinned: boolean;
  archived: boolean;
  /** What this person is to the note. Only passed to the menu, which offers what that role may do. */
  role: NoteRole;
  shared: boolean;
  voice: boolean;
  /** Local edits the server has not accepted. */
  pending: boolean;
  /** The server permanently refused the last push. */
  failed: boolean;
  /** The note's own path, without the view. */
  path: string;
  /** Recently deleted only. Shown by 11h. */
  daysLeft: number | null;
  /** A search matched the transcript but not the text. */
  transcriptOnly: boolean;
  /** The server's id for the note. Null until its first sync. */
  serverId: number | null;
  /** Who owns a note shared with this person, when known. */
  ownerName: string | null;
}

export function fromNoteRow(
  row: NoteRow,
  clipCount: number,
  daysLeft: number | null,
  transcriptOnly = false,
): ListItem {
  const { label, remainder } = deriveNoteLabel(row.content);
  return {
    id: row.localId,
    title: label,
    preview: remainder,
    at: row.localUpdatedAt,
    // Pin is the owner's private state (M-11).
    pinned: row.pinned === 1 && canPin(row.role),
    archived: row.archived === 1,
    role: row.role,
    shared: row.role !== 'owner',
    voice: clipCount > 0,
    pending: row.dirty === 1,
    failed: row.syncState === 'invalid',
    path: ROUTES.legacy.noteOf(row),
    daysLeft,
    transcriptOnly,
    serverId: row.serverId,
    ownerName: null,
  };
}

const SHARED_PREFIX = 'shared-';

export const sharedItemId = (noteId: number): string => `${SHARED_PREFIX}${String(noteId)}`;

/** The server note id behind a Shared with me row id. Null for a row from the notes table. */
export function sharedNoteIdOf(itemId: string): number | null {
  if (!itemId.startsWith(SHARED_PREFIX)) return null;
  const id = Number(itemId.slice(SHARED_PREFIX.length));
  return Number.isInteger(id) ? id : null;
}

export function fromSharedRow(row: SharedRow): ListItem {
  const { label, remainder } = deriveNoteLabel(row.content);
  return {
    id: sharedItemId(row.noteId),
    title: label,
    preview: remainder,
    at: parseServerDateTime(row.updatedAt)?.getTime() ?? 0,
    pinned: false,
    archived: false,
    role: row.role,
    shared: true,
    voice: false,
    pending: false,
    failed: false,
    path: ROUTES.legacy.sharedNote(row.noteId),
    daysLeft: null,
    transcriptOnly: false,
    serverId: row.noteId,
    ownerName: row.ownerName,
  };
}
