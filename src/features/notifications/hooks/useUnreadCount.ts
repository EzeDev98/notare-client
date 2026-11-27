/** Polls the unread notification count. */
import { useQuery } from '@tanstack/react-query';

import { notificationService } from '@/features/notifications/api/notificationService';
import { notificationKeys } from '@/features/notifications/hooks/useNotifications';
import { NOTIFICATIONS_POLL_MS } from '@/core/config/timings';

export function useUnreadCount() {
  const query = useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: ({ signal }) => notificationService.getUnreadCount({ signal }),
    refetchInterval: NOTIFICATIONS_POLL_MS,
    refetchIntervalInBackground: false,
  });

  return query.data?.count ?? 0;
}
