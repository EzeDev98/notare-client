/*
 * The outbox's row shape lives with the notes feature, for the same reason
 * noteRow.ts does: it describes titles, versions, and server ids, and none of
 * that is infrastructure lib/db could own without importing a note.
 */

/**
 * A queued operation, waiting to be pushed.
 *
 * MATCHES THE SERVER'S CONTRACT EXACTLY (ADR-006): three types, the same
 * three fields per type that `SyncOperationRequest` accepts. Pin, archive,
 * and restore are deliberately not representable here — the server has no
 * operation type for them, and inventing a local shape for a request the
 * server would reject is not a queue, it is a dead letter box.
 *
 * ONE ROW PER OPERATION, not one row per note. A note created and then
 * edited offline produces a CREATE row and an UPDATE row, in that order, and
 * both must reach the server in that order — the server applies a batch
 * "sequential, in the order the client queued them" for exactly this reason
 * (a client that created a note and then edited it must not have its UPDATE
 * arrive before its CREATE). Ordering is not a field on this type; it is the
 * table's insertion order, which `id` (Dexie's auto-increment) preserves for
 * free. Nothing here should ever sort by anything else.
 */
export interface OutboxRow {
  /** Auto-increment. Absent until Dexie assigns it on insert. */
  id?: number;

  /**
   * The idempotency key `SyncOperationRequest.operationId` expects.
   *
   * Generated once, when the operation is queued (crypto.randomUUID(), same
   * as localId and clientId) — NOT regenerated on retry. A retried batch
   * must reuse the same key, or a request lost after the server applied it
   * but before the response arrived gets applied a second time.
   */
  operationId: string;

  type: 'CREATE' | 'UPDATE' | 'DELETE';

  /** Which local row this operation came from — how a push result is written back. */
  localId: string;

  /** CREATE only. Null for UPDATE and DELETE, which address an existing server note. */
  clientId: string | null;

  /** UPDATE and DELETE only. Null for CREATE — the note has no server id yet. */
  noteId: number | null;

  /** CREATE and UPDATE. Null for DELETE, which carries no content. */
  title: string | null;
  content: string | null;

  /** UPDATE only — the version this edit was based on, echoed for the conflict check. */
  version: number | null;

  /** When this operation was queued. Diagnostic only — see the note on `id` above for ordering. */
  queuedAt: number;
}
