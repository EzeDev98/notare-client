/** Notification types as the server sends them. */
import type { ServerDateTime } from '@/lib/http/types';

export type NotificationType =
  | 'TRANSCRIPTION_COMPLETED'
  | 'TRANSCRIPTION_FAILED';

export interface NotificationResponse {
  id: number;
  type: NotificationType;
  actorId: number | null;
  targetType: string | null;
  targetId: number | null;
  targetLabel: string | null;
  readAt: ServerDateTime | null;
  createdAt: ServerDateTime;
}

export interface MarkAllReadResponse {
  markedCount: number;
}

export interface UnreadCountResponse {
  count: number;
}
