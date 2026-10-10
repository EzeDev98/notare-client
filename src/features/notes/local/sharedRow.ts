import type { ServerDateTime } from '@/lib/http/types';

/**
 * A read-only local copy of one note shared with this person ("Shared with
 * me"). Filled by sync or by the adapter; never edited here.
 */
export interface SharedRow {
  /** PRIMARY KEY. The server's note id. A shared note has no local id. */
  noteId: number;

  /** What this person may do. Never 'owner': an owner's note is in `notes`. */
  role: 'editor' | 'viewer';

  ownerId: number;
  ownerName: string | null;

  content: string;

  /** As the server expressed it. See NoteRow.createdAt for why it stays a string. */
  updatedAt: ServerDateTime;
}
