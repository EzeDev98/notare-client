import { useQuery } from '@tanstack/react-query';

import { voiceShareService } from '@/features/voiceSharing/api/voiceShareService';

export const voiceShareKeys = {
  all: ['voice-shares'] as const,
  forVoiceNote: (voiceNoteId: number) => [...voiceShareKeys.all, voiceNoteId] as const,
};

/** Every grant on one voice note — the owner's manager page's only read. */
export function useVoiceShares(voiceNoteId: number) {
  return useQuery({
    queryKey: voiceShareKeys.forVoiceNote(voiceNoteId),
    queryFn: ({ signal }) => voiceShareService.listShares(voiceNoteId, { signal }),
  });
}
