import type {
  MarkAllReadResponse,
  NotificationResponse,
  UnreadCountResponse,
} from '@/features/notifications/types';
import { httpClient } from '@/lib/http/client';
import type { PagedResponse } from '@/lib/http/types';

/**
 * `/notifications` — NOTARE-SERVER.md §10/§13. Online-only: notifications
 * are server-truth with no local copy to reconcile (NOTARE-CLIENT-ARCHITECTURE.md §3.4).
 *
 * NO `create`. "No POST /notifications exists and none ever should" (§10:
 * "An endpoint letting one user create a notification for another is a
 * spam vector wearing a feature's name") — there is nothing to wrap here.
 */

const NOTIFICATIONS = '/notifications';

interface Cancellable {
  signal?: AbortSignal;
}

interface ListOptions extends Cancellable {
  unreadOnly?: boolean;
  page?: number;
  size?: number;
}

export const notificationService = {
  listNotifications({
    unreadOnly,
    page,
    size,
    signal,
  }: ListOptions = {}): Promise<PagedResponse<NotificationResponse>> {
    return httpClient.get<PagedResponse<NotificationResponse>>(NOTIFICATIONS, {
      query: { unreadOnly, page, size },
      ...(signal ? { signal } : {}),
    });
  },

  getUnreadCount({ signal }: Cancellable = {}): Promise<UnreadCountResponse> {
    return httpClient.get<UnreadCountResponse>(`${NOTIFICATIONS}/unread-count`, {
      ...(signal ? { signal } : {}),
    });
  },

  /** Idempotent — reading an already-read notification again is a 200,
   * not an error (§13's own note on this endpoint). */
  markRead(id: number, { signal }: Cancellable = {}): Promise<NotificationResponse> {
    return httpClient.post<NotificationResponse>(`${NOTIFICATIONS}/${String(id)}/read`, {
      ...(signal ? { signal } : {}),
    });
  },

  /**
   * The project's only bulk UPDATE (§10) — every row in one sweep gets the
   * identical `readAt` instant, generated server-side. `markedCount` is
   * how many rows that touched, so a caller can distinguish "marked 12" from
   * "there was nothing to mark."
   */
  markAllRead({ signal }: Cancellable = {}): Promise<MarkAllReadResponse> {
    return httpClient.post<MarkAllReadResponse>(`${NOTIFICATIONS}/read-all`, {
      ...(signal ? { signal } : {}),
    });
  },

  /** A REAL delete, not a dismiss-only client-side hide — the row is gone
   * server-side too (§13: "204 | real delete"). */
  deleteNotification(id: number, { signal }: Cancellable = {}): Promise<void> {
    return httpClient.delete<void>(`${NOTIFICATIONS}/${String(id)}`, {
      ...(signal ? { signal } : {}),
    });
  },
};
