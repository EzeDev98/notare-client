/** Fetches the notifications list. */
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { notificationService } from '@/features/notifications/api/notificationService';

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (unreadOnly: boolean, page: number) =>
    [...notificationKeys.all, 'list', unreadOnly, page] as const,
  unreadCount: () => [...notificationKeys.all, 'unread-count'] as const,
};

const PAGE_SIZE = 20;

export function useNotifications(unreadOnly: boolean, page: number, enabled = true) {
  return useQuery({
    queryKey: notificationKeys.list(unreadOnly, page),
    queryFn: ({ signal }) =>
      notificationService.listNotifications({ unreadOnly, page, size: PAGE_SIZE, signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}
