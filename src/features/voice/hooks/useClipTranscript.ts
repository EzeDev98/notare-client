/** A clip's transcript state, read from the device. */
import { transcriptRepository } from '@/features/notes/local/transcriptRepository';
import type { TranscriptRow } from '@/features/notes/local/transcriptRow';
import { useStableLiveQuery as useLiveQuery } from '@/shared/hooks/useStableLiveQuery';

export function useClipTranscript(clipId: string): Pick<TranscriptRow, 'status' | 'text'> | null {
  const row = useLiveQuery(async () => {
    const found = await transcriptRepository.get(clipId);
    return found ? { status: found.status, text: found.text } : null;
  }, [clipId]);
  return row ?? null;
}
