import type { NotificationResponse } from '@/features/notifications/types';

let nextNotificationId = 1;

export function makeNotification(
  overrides: Partial<NotificationResponse> = {},
): NotificationResponse {
  const id = overrides.id ?? nextNotificationId++;
  return {
    id,
    type: 'NOTE_SHARED',
    actorId: 9,
    targetType: 'NOTE',
    targetId: 5,
    targetLabel: 'Q3 Plan',
    readAt: null,
    createdAt: '2026-08-10T09:00:00.000',
    ...overrides,
  };
}

export function resetNotificationFixtures(): void {
  nextNotificationId = 1;
}
