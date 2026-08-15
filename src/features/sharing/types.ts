import type { ServerDateTime } from '@/lib/http/types';

/**
 * The OWNER side's wire types for `/notes/{noteId}/shares` (NOTARE-SERVER.md
 * §13, "Sharing — owner side"). Deliberately a separate module from
 * `features/sharedNotes/types.ts` (the recipient side) and from
 * `features/collaboration/types.ts` — mirrors the server's own three-way
 * split: `NoteShareService` (owner: "is this your note?") vs
 * `SharedNoteService` (recipient: "do you hold a grant?") vs collaboration's
 * separate PENDING/ACCEPTED/REJECTED invitation machine
 * (NOTARE-SERVER.md §9, "Two services, deliberately").
 *
 * A grant and a collaboration are NOT the same row. Sharing requires an
 * accepted collaboration first (NOTARE-CLIENT-ARCHITECTURE.md §2.4, "the
 * share flow is therefore two-stage"), but nothing here re-derives that —
 * the picker on the manager page is what enforces it client-side, by
 * sourcing its options from ACCEPTED collaborations rather than general
 * user search.
 */
export type SharePermission = 'READ' | 'WRITE';

/**
 * One row from `GET /notes/{noteId}/shares`.
 *
 * `sharedWithUserId` is a BARE NUMBER, not a nested `UserSummaryResponse` —
 * this is G1 (NOTARE-CLIENT-ARCHITECTURE.md §1.3): "sharedWithUserId ...
 * numeric ids" are named explicitly among the fields the client cannot turn
 * into a name on its own. Contrast `CollaborationResponse`, which nests
 * `owner`/`collaborator` as full `UserSummaryResponse` objects — the two
 * DTOs are not shaped the same way, and code reading this one must not
 * assume the collaboration convention carried over.
 *
 * Consequence for the UI: a grant's recipient name has to be resolved by
 * cross-referencing this `sharedWithUserId` against the owner's ACCEPTED
 * collaborations (which DO carry a name, via `collaborator`) — see
 * `ShareNote.tsx`'s `resolveName`. A grant with no matching accepted
 * collaboration (its collaboration was cancelled after the grant was made;
 * these are independent rows) falls back to `User {id}`, the same
 * degraded-but-honest pattern the architecture doc itself proposes for
 * notifications under G2.
 *
 * INFERRED, not confirmed by a documented response DTO — NOTARE-SERVER.md
 * gives the entity's persisted fields (§9, "noteId, ownerId,
 * sharedWithUserId ... permission") and the endpoint table, not a DTO
 * listing. `id` and `sharedAt` follow this codebase's own established
 * convention for flagging an inferred shape (see
 * `features/collaboration/types.ts`'s `UserSummaryResponse` doc comment) —
 * revisit if the server ever documents this DTO explicitly.
 */
export interface NoteShareResponse {
  id: number;
  noteId: number;
  sharedWithUserId: number;
  permission: SharePermission;
  sharedAt: ServerDateTime;
}

/**
 * `POST /notes/{noteId}/shares` body (NOTARE-SERVER.md §13: "body:
 * sharedWithUserId, permission"). The two immutable identity fields —
 * `noteId` is in the URL, `ownerId` is never client-supplied at all
 * (NoteShare's own doc comment: both would "permanently equal ownerId").
 */
export interface CreateShareRequest {
  sharedWithUserId: number;
  permission: SharePermission;
}

/**
 * `PUT /notes/{noteId}/shares/{userId}` body. `permission` is the ONLY
 * mutable field on a grant (NoteShare's own doc comment) — there is
 * nothing else this request could carry.
 */
export interface UpdateShareRequest {
  permission: SharePermission;
}
