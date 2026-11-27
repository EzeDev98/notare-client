/** Sync types as the server sends them. */
import type { NoteResponse } from '@/features/notes/types';

export type SyncOperationType = 'CREATE' | 'UPDATE' | 'DELETE';

export interface SyncOperationRequest {
  operationId: string;
  type: SyncOperationType;
  clientId?: string;
  noteId?: number;
  content?: string;
}

export interface SyncBatchRequest {
  operations: SyncOperationRequest[];
}

export type SyncResultStatus = 'APPLIED' | 'NOT_FOUND' | 'INVALID';

export interface SyncOperationResult {
  operationId: string;
  status: SyncResultStatus;

  note?: NoteResponse;

  clientId?: string;

  message?: string;
}

export interface SyncBatchResponse {
  results: SyncOperationResult[];
  appliedCount: number;
  serverTime: string;
}

export interface SyncChangedEntry {
  note: NoteResponse;
  clientId: string | null;
}

export interface SyncPullResponse {
  changed: SyncChangedEntry[];
  deletedIds: number[];
  nextCursor: string;
  hasMore: boolean;
}
