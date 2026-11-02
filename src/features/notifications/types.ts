import type { ServerDateTime } from '@/lib/http/types';

/**
 * NOTARE-SERVER.md §10: "A notification is a historical record, not a live
 * view." Everything here follows from that — `targetLabel` is a SNAPSHOT
 * taken at write time (e.g. a note's name at the moment it was shared),
 * not a live join. If the note is later renamed or deleted, this string
 * does not change and does not go missing — reading it fresh each time
 * would silently rewrite history.
 *
 * "Types are named for the event, not the sentence" (§10): the server
 * sends facts — `type`, `actorId`, `targetType`, `targetId`, `targetLabel`
 * — and the CLIENT composes the wording (`compose.ts`). Phrasing and
 * translation never freeze into historical rows this way, but it means an
 * unrecognised `type` must degrade gracefully rather than crash — see
 * `compose.ts`'s `default` branch.
 */
export type NotificationType =
  | 'COLLABORATION_INVITED'
  | 'COLLABORATION_ACCEPTED'
  | 'COLLABORATION_REJECTED'
  | 'NOTE_SHARED'
  | 'NOTE_SHARE_PERMISSION_CHANGED'
  | 'NOTE_SHARE_REVOKED'
  | 'TRANSCRIPTION_COMPLETED'
  | 'TRANSCRIPTION_FAILED';

/**
 * One row from `GET /notifications`.
 *
 * `actorId` is NULLABLE — §10 is explicit about why: "a finished
 * transcription has no human actor, and 'You transcribed your note' would
 * be a lie the UI must special-case." `compose.ts` branches on this
 * directly rather than ever defaulting a null actor to the current user.
 *
 * `readAt` is the ONLY mutable field, and unread is `readAt === null` — a
 * timestamp, not a boolean (§10: "strictly more information for the same
 * storage, and `(isRead, readAt)` is a redundancy that eventually
 * disagrees with itself").
 *
 * `targetType`/`targetId` are left as `string`/`number` rather than a
 * closed union — the server doc names the `type` values exhaustively but
 * not the `targetType` vocabulary, and this DTO is otherwise INFERRED
 * (entity's persisted columns per §10, not a documented response listing)
 * — flagged per this repo's own convention for an inferred shape.
 */
export interface NotificationResponse {
  id: number;
  type: NotificationType;
  actorId: number | null;
  targetType: string | null;
  targetId: number | null;
  targetLabel: string | null;
  readAt: ServerDateTime | null;
  createdAt: ServerDateTime;
}

/** `POST /notifications/read-all` response — "returns markedCount" (§13). */
export interface MarkAllReadResponse {
  markedCount: number;
}

/**
 * `GET /notifications/unread-count` response shape. INFERRED — the
 * endpoint table (§13) gives the path and a 200, not a body shape. `count`
 * follows this repo's naming for the analogous `markedCount` field on
 * `MarkAllReadResponse`; revisit if the server ever documents this DTO
 * explicitly.
 */
export interface UnreadCountResponse {
  count: number;
}
