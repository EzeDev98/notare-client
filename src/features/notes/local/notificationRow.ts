import type { ServerDateTime } from '@/lib/http/types';

/**
 * A notification cached for the bell and its badge.
 *
 * `readAt` is indexed, and IndexedDB does not index null. So an unread
 * notification (readAt null) is NOT in that index: find unread ones with a
 * filter on the table, never `where('readAt')`.
 */
export interface NotificationRow {
  /** PRIMARY KEY. The server's id. */
  id: number;

  /** The server's type name. An unknown type still shows (master 6.3.1). */
  type: string;

  createdAt: ServerDateTime;
  readAt: ServerDateTime | null;

  /** The rest of the server's payload, kept as received. */
  data: unknown;
}
