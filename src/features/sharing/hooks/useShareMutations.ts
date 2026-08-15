import { useMutation, useQueryClient } from '@tanstack/react-query';

import { shareService } from '@/features/sharing/api/shareService';
import { shareKeys } from '@/features/sharing/hooks/useShares';
import type { CreateShareRequest, SharePermission } from '@/features/sharing/types';

/**
 * All three mutations invalidate the SAME key — unlike collaboration's
 * split sent()/received() invalidation, every grant mutation here acts on
 * one note's one list, so there is only ever one cache entry to be stale.
 */

export function useCreateShare(noteId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateShareRequest) => shareService.createShare(noteId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: shareKeys.forNote(noteId) });
    },
  });
}

export function useUpdateShare(noteId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, permission }: { userId: number; permission: SharePermission }) =>
      shareService.updateShare(noteId, userId, { permission }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: shareKeys.forNote(noteId) });
    },
  });
}

/**
 * Revoke. Deletes, so — same as `useCancelCollaboration` — there is
 * nothing in the response to adopt; the row is simply gone on success.
 */
export function useRevokeShare(noteId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: number) => shareService.revokeShare(noteId, userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: shareKeys.forNote(noteId) });
    },
  });
}
