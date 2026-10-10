import { useQuery } from '@tanstack/react-query';

import { notificationService } from '@/features/notifications/api/notificationService';
import { notificationKeys } from '@/features/notifications/hooks/useNotifications';
import { NOTIFICATIONS_POLL_MS } from '@/core/config/timings';

/**
 * Architecture doc §2.5: "Polling only. Poll `/notifications/unread-count`
 * on an interval and on tab focus." `refetchOnWindowFocus` is already a
 * global default (`QueryProvider.tsx`'s own doc comment names this exact
 * hook as the reason that default exists) — only the interval is specific
 * to this hook.
 *
 * 60s, not faster: an unread badge is a hint, not a live feed — nothing
 * in this app promises the count is correct to the second, and the
 * architecture doc's own G8 notes there is no push/SSE, so this is v1's
 * whole answer to "is there anything new."
 */
export function useUnreadCount() {
  const query = useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: ({ signal }) => notificationService.getUnreadCount({ signal }),
    refetchInterval: NOTIFICATIONS_POLL_MS,
    // Hidden tabs stay quiet (D-14). This is React Query's default, stated so it stays that way.
    refetchIntervalInBackground: false,
  });

  return query.data?.count ?? 0;
}
