import type {
  CollaborationResponse,
  CreateCollaborationRequest,
} from '@/features/collaboration/types';
import { httpClient } from '@/lib/http/client';
import type { PagedResponse } from '@/lib/http/types';

/**
 * The collaboration state machine's HTTP surface. See `types.ts` for the
 * transition table this mirrors.
 *
 * Top-level `/collaborations`, not nested under `/users/{id}` — see
 * `types.ts`'s doc comment for why. `/sent` and `/received` are the two
 * views onto the SAME rows, disambiguated by which side of `owner` /
 * `collaborator` matches CurrentUser.id — this service does not do that
 * comparison; that is a hook/component concern, not a fetch concern.
 *
 * NOTHING HERE CATCHES: a 404 on accept/reject/cancel means "not the
 * invitee/owner, or does not exist" (server does not distinguish), and a
 * 400 means the opposite-terminal-state case (`isBadRequest`). Both need
 * to reach the caller as errors to react to, not be swallowed here.
 */

const COLLABORATIONS = '/collaborations';

interface Cancellable {
  signal?: AbortSignal;
}

export const collaborationService = {
  /** Owner-initiated. The caller becomes `owner`; `collaboratorId` becomes the invitee. */
  createCollaboration(
    body: CreateCollaborationRequest,
    { signal }: Cancellable = {},
  ): Promise<CollaborationResponse> {
    return httpClient.post<CollaborationResponse>(COLLABORATIONS, {
      body,
      ...(signal ? { signal } : {}),
    });
  },

  /** Invitee-only. Same-status (already ACCEPTED) is an idempotent 200. */
  acceptCollaboration(id: number, { signal }: Cancellable = {}): Promise<CollaborationResponse> {
    return httpClient.post<CollaborationResponse>(`${COLLABORATIONS}/${String(id)}/accept`, {
      ...(signal ? { signal } : {}),
    });
  },

  /**
   * Invitee-only. Leaves an auditable REJECTED row — deliberately different
   * from `cancelCollaboration`, which deletes the row outright. Do not
   * treat these as interchangeable "remove this invite" actions in the UI.
   */
  rejectCollaboration(id: number, { signal }: Cancellable = {}): Promise<CollaborationResponse> {
    return httpClient.post<CollaborationResponse>(`${COLLABORATIONS}/${String(id)}/reject`, {
      ...(signal ? { signal } : {}),
    });
  },

  /**
   * Owner-only. DELETE, not a status change — the row is gone, not marked
   * anything. Valid from ANY status (not just PENDING): an owner can
   * retract an already-accepted grant, which is how a collaborator's
   * access actually gets revoked (there is no separate "revoke" endpoint).
   */
  cancelCollaboration(id: number, { signal }: Cancellable = {}): Promise<void> {
    return httpClient.delete<void>(`${COLLABORATIONS}/${String(id)}`, {
      ...(signal ? { signal } : {}),
    });
  },

  /** Invitations/grants where the current user is the owner. */
  listSent({ signal }: Cancellable = {}): Promise<PagedResponse<CollaborationResponse>> {
    return httpClient.get<PagedResponse<CollaborationResponse>>(`${COLLABORATIONS}/sent`, {
      ...(signal ? { signal } : {}),
    });
  },

  /** Invitations/grants where the current user is the collaborator. */
  listReceived({ signal }: Cancellable = {}): Promise<PagedResponse<CollaborationResponse>> {
    return httpClient.get<PagedResponse<CollaborationResponse>>(`${COLLABORATIONS}/received`, {
      ...(signal ? { signal } : {}),
    });
  },
};
