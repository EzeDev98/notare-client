import { useMutation, useQueryClient } from '@tanstack/react-query';

import { voiceShareService } from '@/features/voiceSharing/api/voiceShareService';
import { voiceShareKeys } from '@/features/voiceSharing/hooks/useVoiceShares';
import type { CreateVoiceShareRequest, SharePermission } from '@/features/voiceSharing/types';

/**
 * All three mutations invalidate the SAME key — mirrors shareService's own
 * hooks: every grant mutation here acts on one voice note's one list, so
 * there is only ever one cache entry to be stale.
 */

export function useCreateVoiceShare(voiceNoteId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateVoiceShareRequest) => voiceShareService.createShare(voiceNoteId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: voiceShareKeys.forVoiceNote(voiceNoteId) });
    },
  });
}

export function useUpdateVoiceShare(voiceNoteId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, permission }: { userId: number; permission: SharePermission }) =>
      voiceShareService.updateShare(voiceNoteId, userId, { permission }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: voiceShareKeys.forVoiceNote(voiceNoteId) });
    },
  });
}

/**
 * Revoke. Deletes, so — same as `useRevokeShare` — there is nothing in the
 * response to adopt; the row is simply gone on success.
 */
export function useRevokeVoiceShare(voiceNoteId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: number) => voiceShareService.revokeShare(voiceNoteId, userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: voiceShareKeys.forVoiceNote(voiceNoteId) });
    },
  });
}
