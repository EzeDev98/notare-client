import { useMutation, useQueryClient } from '@tanstack/react-query';

import { transcriptionService } from '@/features/voice/api/transcriptionService';
import { transcriptionKeys } from '@/features/voice/hooks/useTranscription';

/**
 * ONE mutation, not two. `submitTranscription` is idempotent and FAILED
 * resets to PENDING and republishes (transcriptionService.ts's own doc
 * comment) — "submit" and "retry" are the identical server call, so a
 * separate `useRetryTranscription` would just be this with a different
 * name.
 */
export function useSubmitTranscription(voiceNoteId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => transcriptionService.submitTranscription(voiceNoteId),
    onSuccess: (result) => {
      queryClient.setQueryData(transcriptionKeys.detail(voiceNoteId), result);
    },
  });
}
