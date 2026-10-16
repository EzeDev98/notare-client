import type { ServerDateTime } from '@/lib/http/types';

/**
 * One row of "Shared with me", `GET /shared-notes`. Flat, and shaped for the
 * recipient: the owner's pin, archive and version never appear here.
 *
 * Opening a shared note is not this module's job. It opens at `ROUTES.note(id)`
 * like any other note, and the role decides what is allowed.
 */
export type SharedRole = 'VIEWER' | 'EDITOR';

export interface SharedNoteSummaryResponse {
  shareId: number;
  noteId: number;
  title: string | null;
  contentPreview: string | null;
  ownerName: string | null;
  role: SharedRole;
  updatedAt: ServerDateTime;
  sharedAt: ServerDateTime;
}
