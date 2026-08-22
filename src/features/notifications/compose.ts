import type { NotificationResponse, NotificationType } from '@/features/notifications/types';

/**
 * "The client composes the sentence from `type` + resolved actor +
 * `targetLabel`. A `NotificationType` the client does not recognise must
 * render a generic line, not crash and not render blank."
 * (NOTARE-CLIENT-ARCHITECTURE.md §2.5)
 *
 * Pure function, no fetching — Vitest-testable in isolation, same
 * treatment this codebase already gives the autosave scheduler and sync
 * result dispatch (architecture doc §7's testing table names "notification
 * composition" as one of these explicitly).
 *
 * `resolveActor` is injected rather than baked in: this module has no way
 * to know anyone's name (G1/G2 — the client cannot resolve a bare user id
 * at all without a source), so the CALLER supplies whatever best-effort
 * lookup it has on hand (e.g. `Notifications.tsx` builds one from cached
 * accepted collaborations, the same technique `ShareNote.tsx`'s
 * `resolveName` already uses for `sharedWithUserId`). An id with no match
 * degrades to "Someone" — never a raw id.
 */
export type ActorResolver = (actorId: number) => string | undefined;

const UNKNOWN_ACTOR = 'Someone';

function actorName(notification: NotificationResponse, resolveActor: ActorResolver): string {
  if (notification.actorId === null) return UNKNOWN_ACTOR;
  return resolveActor(notification.actorId) ?? UNKNOWN_ACTOR;
}

/**
 * The known types, one line each. `targetLabel` is used only where it
 * plausibly denotes a note's name (§10's own example: "Femi shared 'Q3
 * Plan'") — collaboration-type notifications don't reference a note at
 * all (a collaboration is a person-to-person relationship, not scoped to
 * one — `features/collaboration/types.ts`'s own doc comment), so those
 * three compose from the actor alone.
 */
export function composeNotificationMessage(
  notification: NotificationResponse,
  resolveActor: ActorResolver,
): string {
  switch (notification.type) {
    case 'COLLABORATION_INVITED':
      return `${actorName(notification, resolveActor)} invited you to collaborate`;
    case 'COLLABORATION_ACCEPTED':
      return `${actorName(notification, resolveActor)} accepted your invitation`;
    case 'COLLABORATION_REJECTED':
      return `${actorName(notification, resolveActor)} declined your invitation`;
    case 'NOTE_SHARED':
      return `${actorName(notification, resolveActor)} shared “${notification.targetLabel}” with you`;
    case 'NOTE_SHARE_PERMISSION_CHANGED':
      return `${actorName(notification, resolveActor)} changed your permission on “${notification.targetLabel}”`;
    case 'NOTE_SHARE_REVOKED':
      return `${actorName(notification, resolveActor)} removed your access to “${notification.targetLabel}”`;
    case 'TRANSCRIPTION_COMPLETED':
      // §10: transcription notifications never have a human actor — this
      // branch does not call actorName at all, on purpose.
      return `Transcription finished for “${notification.targetLabel}”`;
    case 'TRANSCRIPTION_FAILED':
      return `Transcription failed for “${notification.targetLabel}”`;
    default: {
      /*
       * `notification.type` narrows to `never` here — every KNOWN variant
       * is handled above, so TypeScript enforces this switch stays
       * exhaustive as the union grows (delete a case and the build breaks,
       * same technique `lib/http/errors.ts`'s `describe` already uses).
       * That is a COMPILE-TIME guarantee about known types; it says
       * nothing about a value that actually arrives over the network,
       * which is untyped `unknown` until this line. A ninth server-side
       * type this client has never heard of reaches this branch at
       * runtime regardless of what TypeScript believes about
       * exhaustiveness — which is exactly the case §10 warns about
       * ("adding a type server-side breaks old clients" is the accepted
       * cost) and exactly what this generic fallback exists to survive.
       */
      return 'You have a new notification';
    }
  }
}

/** For a `<select>` or a filter chip — not used by `compose` itself. */
export const ALL_NOTIFICATION_TYPES: NotificationType[] = [
  'COLLABORATION_INVITED',
  'COLLABORATION_ACCEPTED',
  'COLLABORATION_REJECTED',
  'NOTE_SHARED',
  'NOTE_SHARE_PERMISSION_CHANGED',
  'NOTE_SHARE_REVOKED',
  'TRANSCRIPTION_COMPLETED',
  'TRANSCRIPTION_FAILED',
];
