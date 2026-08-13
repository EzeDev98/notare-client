import type { NoteResponse } from '@/features/notes/types';

/**
 * The sync subsystem's own wire types, separate from `features/notes/types.ts`.
 *
 * `src/sync/` is deliberately not under `features/` (architecture doc §3) —
 * it is a subsystem that moves data between Dexie and the server, not a
 * screen. Its wire types live with it for the same reason `noteService`'s
 * live with notes: one file owns the question "what does this endpoint
 * actually send and receive".
 */

export type SyncOperationType = 'CREATE' | 'UPDATE' | 'DELETE';

/**
 * One queued operation, exactly as `POST /sync/batch` accepts it.
 *
 * Matches `OutboxRow` field-for-field (that row type exists BECAUSE it
 * matches this contract — see ADR-006), except optional here rather than
 * `| null`: the server DTO omits absent fields rather than sending them as
 * null, and `toOperationRequest` in push.ts is the one place that does that
 * translation.
 */
export interface SyncOperationRequest {
  operationId: string;
  type: SyncOperationType;
  clientId?: string;
  noteId?: number;
  title?: string;
  content?: string;
  version?: number;
}

export interface SyncBatchRequest {
  operations: SyncOperationRequest[];
}

/**
 * The four outcomes the server defines for one operation. Client behaviour
 * per status is documented where each is handled, in `push.ts`.
 */
export type SyncResultStatus = 'APPLIED' | 'CONFLICT' | 'NOT_FOUND' | 'INVALID';

export interface SyncOperationResult {
  operationId: string;
  status: SyncResultStatus;

  /**
   * Present on APPLIED (CREATE/UPDATE — carries the id/version to adopt) and
   * on CONFLICT (the server's current note, per the architecture doc's
   * explicit reasoning: a bare version would mean a follow-up fetch per
   * conflict). Absent on NOT_FOUND and on an APPLIED DELETE — there is
   * nothing left on the server to describe.
   */
  note?: NoteResponse;

  /** Echoed on a CREATE result; not otherwise meaningful here. */
  clientId?: string;

  /** Present on INVALID — the reason, for the log line and, later, a bug report. */
  message?: string;
}

export interface SyncBatchResponse {
  results: SyncOperationResult[];
  appliedCount: number;
  conflictCount: number;
  serverTime: string;
}

/**
 * One note as GET /sync's `changed[]` returns it: `NoteResponse` plus the
 * client-generated id that lets an offline-created note recognise itself
 * arriving through a pull instead of being inserted as a duplicate (2.3).
 *
 * `null` for any note that was never created offline — `Note.clientId` is
 * nullable on the server for exactly that case (architecture doc §2.3).
 */
export interface SyncNoteResponse extends NoteResponse {
  clientId: string | null;
}

/**
 * `GET /sync`'s response envelope.
 *
 * `nextCursor` is deliberately NOT the thing to advance the stored cursor
 * with while `hasMore` is true — see pull.ts, which is the one place that
 * writes `meta.cursor`. `deletedIds` is tombstones only: a PERMANENT delete.
 * A soft delete arrives through `changed` like any other update, because the
 * row still exists (architecture doc §11, "soft delete gives tombstones
 * free").
 */
export interface SyncPullResponse {
  changed: SyncNoteResponse[];
  deletedIds: number[];
  nextCursor: string;
  hasMore: boolean;
}
