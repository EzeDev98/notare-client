/** Note types as the server sends them. */
import type { ServerDateTime } from '@/lib/http/types';

export interface NoteResponse {
  id: number;
  content: string | null;
  pinned: boolean;

  version: number;

  createdAt: ServerDateTime;
  updatedAt: ServerDateTime;
  ownerId: number;
  lastModifiedBy: number | null;
  restorable?: boolean;
  aiTitle?: string | null;
}

export interface NoteSummaryResponse {
  id: number;
  contentPreview: string | null;
  pinned: boolean;
  version: number;
  updatedAt: ServerDateTime;
}

export interface CreateNoteRequest {
  content?: string;
  clientId?: string;
}

export interface UpdateNoteRequest {
  content: string | null;
}

export interface AutoSaveNoteRequest {
  content?: string;
}
