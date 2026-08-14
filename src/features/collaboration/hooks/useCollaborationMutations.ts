import { useMutation, useQueryClient } from '@tanstack/react-query';

import { collaborationService } from '@/features/collaboration/api/collaborationService';
import { collaborationKeys } from '@/features/collaboration/hooks/useCollaborations';
import type { CreateCollaborationRequest } from '@/features/collaboration/types';

/**
 * Each mutation invalidates only the list its OWN actor can see the effect
 * in — not both, because the two collections belong to two different users'
 * sessions and this client only ever holds one of them at a time:
 *
 *   create  -> owner's "sent" gains a row      -> invalidate sent()
 *   accept  -> invitee-only, acts on "received" -> invalidate received()
 *   reject  -> invitee-only, acts on "received" -> invalidate received()
 *   cancel  -> owner-only, acts on "sent"        -> invalidate sent()
 */

export function useCreateCollaboration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateCollaborationRequest) =>
      collaborationService.createCollaboration(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: collaborationKeys.sent() });
    },
  });
}

export function useAcceptCollaboration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => collaborationService.acceptCollaboration(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: collaborationKeys.received() });
    },
  });
}

export function useRejectCollaboration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => collaborationService.rejectCollaboration(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: collaborationKeys.received() });
    },
  });
}

/**
 * Owner retracting a sent invitation OR an already-accepted grant — this is
 * the only revocation path (`collaborationService.cancelCollaboration`'s
 * doc comment). Deletes, so there is nothing to adopt from the response;
 * the row is simply removed from `sent` on success.
 */
export function useCancelCollaboration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => collaborationService.cancelCollaboration(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: collaborationKeys.sent() });
    },
  });
}
