/** A notification as stored on the device. */
import type { ServerDateTime } from '@/lib/http/types';

export interface NotificationRow {
  id: number;

  type: string;

  createdAt: ServerDateTime;
  readAt: ServerDateTime | null;

  data: unknown;
}
