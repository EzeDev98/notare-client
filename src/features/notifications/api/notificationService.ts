/** Server calls for notifications. */
import type {
  MarkAllReadResponse,
  NotificationResponse,
  UnreadCountResponse,
} from '@/features/notifications/types';
import { httpClient } from '@/lib/http/client';
import type { PagedResponse } from '@/lib/http/types';

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

  markRead(id: number, { signal }: Cancellable = {}): Promise<NotificationResponse> {
    return httpClient.post<NotificationResponse>(`${NOTIFICATIONS}/${String(id)}/read`, {
      ...(signal ? { signal } : {}),
    });
  },

  markAllRead({ signal }: Cancellable = {}): Promise<MarkAllReadResponse> {
    return httpClient.post<MarkAllReadResponse>(`${NOTIFICATIONS}/read-all`, {
      ...(signal ? { signal } : {}),
    });
  },

  deleteNotification(id: number, { signal }: Cancellable = {}): Promise<void> {
    return httpClient.delete<void>(`${NOTIFICATIONS}/${String(id)}`, {
      ...(signal ? { signal } : {}),
    });
  },
};
