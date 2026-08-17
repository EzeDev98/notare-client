import type { ServerDateTime } from '@/lib/http/types';

/**
 * NOTARE-SERVER.md §8: /collaborations, top-level rather than nested under
 * /users/{id}, specifically so ownership of the relationship isn't forced
 * onto either side — the owner sees a row under "sent", the invitee sees
 * the SAME row under "received".
 *
 * State machine (server-enforced, not re-implemented client-side):
 *   PENDING --accept--> ACCEPTED   (invitee only)
 *   PENDING --reject--> REJECTED   (invitee only)
 *   any     --cancel--> row deleted (owner only, DELETE)
 * Same-status transition is an idempotent 200. A transition between the two
 * TERMINAL states (e.g. accepting an already-rejected invite) is a 400 —
 * see `isBadRequest` in lib/http/errors.ts. "Invitee only" / "owner only"
 * is enforced by the query itself, so a mismatch is 404, not 403.
 */
export type CollaborationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

/**
 * A row from GET /user/search. No email — this is other people's data, not
 * the caller's own profile (contrast with CurrentUser, which does carry
 * email because it's a self-lookup).
 *
 * INFERRED, not confirmed by a documented DTO. Based on CurrentUser's shape
 * (auth/types.ts) minus email/gender/createdAt, none of which belong in a
 * search result over other users. Flagged per this repo's own convention:
 * revisit if the server ever documents this DTO explicitly.
 */
export interface UserSummaryResponse {
  id: number;
  notarianId: string;
  username: string;
  firstName: string;
  lastName: string;
}

/**
 * One row from GET /collaborations/sent or GET /collaborations/received —
 * same shape either way. Which side is "me" is for the caller to work out
 * by comparing `owner.id`/`collaborator.id` against CurrentUser.id; the
 * server does not flag it per-row, because the same row IS both an owner's
 * sent invite and a collaborator's received one simultaneously.
 *
 * NO `noteId`, NO `noteTitle`, NO `permission` — a collaboration is a
 * relationship between two people, not a grant on a note.
 * NOTARE-SERVER.md §8 is explicit: "`Collaboration` models the
 * relationship, not a person: `ownerId`, `collaboratorId`, `status`,
 * `UNIQUE(owner_id, collaborator_id)`, `lastModifiedBy`" — no note-related
 * column exists on the entity at all. NOTARE-CLIENT-ARCHITECTURE.md §2.4
 * confirms the UI consequence: "the share flow is therefore two-stage:
 * you invite someone, they accept, *then* you can share notes with them" —
 * sharing a specific note happens later, via a completely separate
 * resource (`features/sharing`, `/notes/{noteId}/shares`).
 *
 * PREVIOUSLY WRONG in this file: earlier versions carried `noteId`,
 * `noteTitle`, and `permission` here, which don't exist on the server's
 * response and would have forced an invite flow that picks a note before
 * inviting someone — backwards from the documented two-stage design.
 * Corrected before building the invite page (9C) on top of it.
 */
export interface CollaborationResponse {
  id: number;
  ownerId: number;
  collaboratorId: number;
  status: CollaborationStatus;
  createdAt: ServerDateTime;
  updatedAt: ServerDateTime;
}

/**
 * POST /collaborations. Owner-initiated: the caller is always the owner,
 * `collaboratorId` is always the invitee — there is no path where a person
 * invites themselves onto their own note as a collaborator, so that
 * asymmetry is baked into the request shape rather than validated after
 * the fact.
 *
 * ONLY `collaboratorId` — NOTARE-SERVER.md §13's endpoint table is
 * explicit: "POST | /collaborations | 201 + Location | body:
 * collaboratorId". No `noteId`, no `permission`; see `CollaborationResponse`
 * above for why.
 */
export interface CreateCollaborationRequest {
  collaboratorId: number;
}
