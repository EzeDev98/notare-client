import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { notificationService } from '@/features/notifications/api/notificationService';

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (unreadOnly: boolean, page: number) =>
    [...notificationKeys.all, 'list', unreadOnly, page] as const,
  unreadCount: () => [...notificationKeys.all, 'unread-count'] as const,
};

const PAGE_SIZE = 20;

/**
 * The `/notifications` list — "fetch the list on open" (architecture doc
 * §2.5), not polled continuously; `useUnreadCount` is the one thing that
 * polls. `keepPreviousData` so toggling the unread filter or paging
 * doesn't blank the screen mid-fetch, same reasoning `useSharedNotes`
 * already established for this codebase's other paged online-only lists.
 */
export function useNotifications(unreadOnly: boolean, page: number) {
  return useQuery({
    queryKey: notificationKeys.list(unreadOnly, page),
    queryFn: ({ signal }) =>
      notificationService.listNotifications({ unreadOnly, page, size: PAGE_SIZE, signal }),
    placeholderData: keepPreviousData,
  });
}
