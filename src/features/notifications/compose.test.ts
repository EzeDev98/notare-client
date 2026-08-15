import { describe, expect, it } from 'vitest';

import { composeNotificationMessage } from '@/features/notifications/compose';
import type { NotificationResponse, NotificationType } from '@/features/notifications/types';

function makeNotification(overrides: Partial<NotificationResponse> = {}): NotificationResponse {
  return {
    id: 1,
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

const resolveKnownActor = (actorId: number): string | undefined =>
  actorId === 9 ? 'Femi Ade' : undefined;

describe('composeNotificationMessage', () => {
  it('composes NOTE_SHARED with the resolved actor and the snapshotted target label', () => {
    const message = composeNotificationMessage(makeNotification(), resolveKnownActor);
    expect(message).toBe('Femi Ade shared “Q3 Plan” with you');
  });

  it('composes each known collaboration type from the actor alone, no note reference', () => {
    const invited = composeNotificationMessage(
      makeNotification({ type: 'COLLABORATION_INVITED' }),
      resolveKnownActor,
    );
    const accepted = composeNotificationMessage(
      makeNotification({ type: 'COLLABORATION_ACCEPTED' }),
      resolveKnownActor,
    );
    const rejected = composeNotificationMessage(
      makeNotification({ type: 'COLLABORATION_REJECTED' }),
      resolveKnownActor,
    );

    expect(invited).toBe('Femi Ade invited you to collaborate');
    expect(accepted).toBe('Femi Ade accepted your invitation');
    expect(rejected).toBe('Femi Ade declined your invitation');
  });

  it('falls back to "Someone" when the actor cannot be resolved', () => {
    const message = composeNotificationMessage(
      makeNotification({ actorId: 404 }),
      resolveKnownActor,
    );
    expect(message).toBe('Someone shared “Q3 Plan” with you');
  });

  it('never mentions an actor for a transcription event, even with a resolver on hand', () => {
    const completed = composeNotificationMessage(
      makeNotification({ type: 'TRANSCRIPTION_COMPLETED', actorId: null, targetLabel: 'Voice memo' }),
      resolveKnownActor,
    );
    const failed = composeNotificationMessage(
      makeNotification({ type: 'TRANSCRIPTION_FAILED', actorId: null, targetLabel: 'Voice memo' }),
      resolveKnownActor,
    );

    expect(completed).toBe('Transcription finished for “Voice memo”');
    expect(failed).toBe('Transcription failed for “Voice memo”');
  });

  it('renders a generic fallback for a type this client has never heard of, rather than crashing or rendering blank', () => {
    const message = composeNotificationMessage(
      makeNotification({ type: 'SOMETHING_FUTURE' as unknown as NotificationType }),
      resolveKnownActor,
    );
    expect(message).toBe('You have a new notification');
  });
});
