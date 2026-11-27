import { NOTIFICATION_COPY as C } from '@/features/notifications/notificationContent';
import type { NotificationResponse } from '@/features/notifications/types';
import { formatServerDateTimeRelative } from '@/lib/time';

export type NotificationAction = 'open' | 'retry' | null;

export interface ComposedNotification {
  text: string;
  meta: string;
  action: NotificationAction;
}

/**
 * The sentence, the small line under it and the buttons for one notification.
 * It switches on the type as a plain string, so a type this client has never
 * heard of still gets a sentence.
 */
export function composeNotification(n: NotificationResponse): ComposedNotification {
  const when = formatServerDateTimeRelative(n.createdAt);
  const meta = (label: string): string => `${label} · ${when}`;

  switch (n.type as string) {
    case 'TRANSCRIPTION_COMPLETED':
      return { text: C.texts.transcriptReady, meta: meta(C.labels.transcript), action: 'open' };
    case 'TRANSCRIPTION_FAILED':
      return { text: C.texts.transcriptFailed, meta: meta(C.labels.transcript), action: 'retry' };
    default:
      return { text: C.texts.unknown, meta: when, action: null };
  }
}
