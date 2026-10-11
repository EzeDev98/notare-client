import { NOTIFICATION_COPY as C } from '@/features/notifications/notificationContent';
import type { NotificationResponse } from '@/features/notifications/types';
import { formatServerDateTimeRelative } from '@/lib/time';

export type NotificationAction = 'invite' | 'open' | 'retry' | null;

export interface ComposedNotification {
  text: string;
  meta: string;
  action: NotificationAction;
}

/**
 * The sentence, the small line under it and the buttons for one notification.
 * It switches on the type as a plain string, so a type this client has never
 * heard of still gets a sentence. A voice-note type has no button until step 18.
 */
export function composeNotification(
  n: NotificationResponse,
  actor: string | undefined,
  role?: 'viewer' | 'editor',
): ComposedNotification {
  const name = actor ?? C.someone;
  const title = n.targetLabel.trim() === '' ? C.untitled : n.targetLabel.trim();
  const when = formatServerDateTimeRelative(n.createdAt);
  const meta = (label: string): string => `${label} · ${when}`;

  switch (n.type as string) {
    case 'COLLABORATION_INVITED':
      return { text: C.texts.invited(name), meta: meta(C.labels.connection), action: 'invite' };
    case 'COLLABORATION_ACCEPTED':
      return { text: C.texts.accepted(name), meta: meta(C.labels.connection), action: null };
    case 'COLLABORATION_REJECTED':
      return { text: C.texts.declined(name), meta: meta(C.labels.connection), action: null };
    case 'NOTE_SHARED':
      return { text: C.texts.shared(name, title), meta: meta(title), action: 'open' };
    case 'NOTE_SHARE_PERMISSION_CHANGED':
      return {
        text: role ? C.texts.accessTo(name, C.roles[role]) : C.texts.access(name),
        meta: meta(C.labels.note),
        action: 'open',
      };
    case 'NOTE_SHARE_REVOKED':
      return { text: C.texts.revoked(name, title), meta: meta(C.labels.note), action: null };
    case 'TRANSCRIPTION_COMPLETED':
      return { text: C.texts.transcriptReady, meta: meta(C.labels.transcript), action: 'open' };
    case 'TRANSCRIPTION_FAILED':
      return { text: C.texts.transcriptFailed, meta: meta(C.labels.transcript), action: 'retry' };
    case 'VOICE_NOTE_SHARED':
      return { text: C.texts.voiceShared(name), meta: meta(C.labels.voice), action: null };
    case 'VOICE_NOTE_SHARE_PERMISSION_CHANGED':
      return { text: C.texts.voiceAccess(name), meta: meta(C.labels.voice), action: null };
    default:
      return { text: C.texts.unknown, meta: when, action: null };
  }
}
