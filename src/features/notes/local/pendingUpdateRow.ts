/** A local Yjs update the server has not acknowledged yet (step 16b). */
export interface PendingUpdateRow {
  /** Assigned on insert. Rows are sent in this order. */
  id?: number;
  /** The server id of the note. */
  noteId: number;
  bytes: Uint8Array;
}
