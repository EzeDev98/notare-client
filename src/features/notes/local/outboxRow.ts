/** One note change waiting to be sent. */
export interface OutboxRow {
  id?: number;

  operationId: string;

  type: 'CREATE' | 'UPDATE' | 'DELETE';

  localId: string;

  clientId: string | null;

  noteId: number | null;

  content: string | null;

  version: number | null;

  queuedAt: number;
}
