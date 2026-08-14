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
 * Field set INFERRED from the endpoint contract, not a confirmed DTO listing
 * — `owner`/`collaborator` nested as UserSummaryResponse follows the
 * server's established "nest, don't flatten" convention (NOTARE-SERVER.md
 * §3.6, already confirmed for SharedNoteSummaryResponse).
 */
export interface CollaborationResponse {
  id: number;
  noteId: number;
  noteTitle: string;
  owner: UserSummaryResponse;
  collaborator: UserSummaryResponse;
  permission: 'READ' | 'WRITE';
  status: CollaborationStatus;
  createdAt: ServerDateTime;
}

/**
 * POST /collaborations. Owner-initiated: the caller is always the owner,
 * `collaboratorId` is always the invitee — there is no path where a person
 * invites themselves onto their own note as a collaborator, so that
 * asymmetry is baked into the request shape rather than validated after
 * the fact.
 */
export interface CreateCollaborationRequest {
  noteId: number;
  collaboratorId: number;
  permission: 'READ' | 'WRITE';
}
