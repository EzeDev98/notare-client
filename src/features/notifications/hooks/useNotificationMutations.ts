import { useMutation, useQueryClient } from '@tanstack/react-query';

import { notificationService } from '@/features/notifications/api/notificationService';
import { notificationKeys } from '@/features/notifications/hooks/useNotifications';

/**
 * All three invalidate the whole `notifications` branch — list AND
 * unread-count together. Every mutation here changes `readAt` on at least
 * one row (or removes one outright), and the unread count is a derived
 * fact of exactly that column, so there is no version of "mark read" that
 * leaves the count still accurate.
 */

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => notificationService.markRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => notificationService.deleteNotification(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
