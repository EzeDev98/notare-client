import { ROUTES } from '@/app/routes';
import { deriveNoteLabel } from '@/features/notes/local/noteLabel';
import type { NoteRow } from '@/features/notes/local/noteRow';

/** What one list row needs, and nothing more. Small on purpose: it is compared on every database change. */
export interface ListItem {
  id: string;
  title: string;
  preview: string;
  /** Epoch ms: when the note was last touched. Orders the list and picks the group. */
  at: number;
  pinned: boolean;
  voice: boolean;
  /** Local edits the server has not accepted. */
  pending: boolean;
  /** The server permanently refused the last push. */
  failed: boolean;
  /** The note's own path, without the view. */
  path: string;
  /** A search matched the transcript but not the text. */
  transcriptOnly: boolean;
  /** The server's id for the note. Null until its first sync. */
  serverId: number | null;
}

export function fromNoteRow(
  row: NoteRow,
  clipCount: number,
  transcriptOnly = false,
): ListItem {
  const { label, remainder } = deriveNoteLabel(row.content, row.aiTitle);
  return {
    id: row.localId,
    title: label,
    preview: remainder,
    at: row.localUpdatedAt,
    pinned: row.pinned === 1,
    voice: clipCount > 0,
    pending: row.dirty === 1,
    failed: row.syncState === 'invalid',
    path: ROUTES.legacy.noteOf(row),
    transcriptOnly,
    serverId: row.serverId,
  };
}
