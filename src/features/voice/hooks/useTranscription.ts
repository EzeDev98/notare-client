import { useQuery } from '@tanstack/react-query';

import { transcriptionService } from '@/features/voice/api/transcriptionService';

export const transcriptionKeys = {
  detail: (voiceNoteId: number) => ['transcription', voiceNoteId] as const,
};

/**
 * "Polling with backoff" (architecture doc §2.6) — for this stub engine
 * (§7: `StubTranscriptionEngine` simulates a 1.5s delay), a flat interval
 * a little under that is enough to observe `PROCESSING` at least once
 * without hammering the endpoint; a real engine taking longer would want
 * a genuine backoff curve, which `refetchInterval` as a function makes
 * easy to grow into later without changing the caller.
 *
 * Polling STOPS itself once the status is terminal (`COMPLETED`/`FAILED`)
 * — `refetchInterval` returning `false` disables the timer entirely
 * rather than polling a status that will never change again.
 */
const POLL_INTERVAL_MS = 1_000;

export function useTranscription(voiceNoteId: number | null, enabled = true) {
  return useQuery({
    queryKey: transcriptionKeys.detail(voiceNoteId ?? -1),
    queryFn: ({ signal }) =>
      transcriptionService.getTranscription(voiceNoteId as number, { signal }),
    enabled: enabled && voiceNoteId !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'PENDING' || status === 'PROCESSING' ? POLL_INTERVAL_MS : false;
    },
  });
}
