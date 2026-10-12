import { transcriptRepository } from '@/features/notes/local/transcriptRepository';
import type { TranscriptRow } from '@/features/notes/local/transcriptRow';
import { useStableLiveQuery as useLiveQuery } from '@/shared/hooks/useStableLiveQuery';

/** The transcript state of one clip, read from the device. */
export function useClipTranscript(clipId: string): Pick<TranscriptRow, 'status' | 'text'> | null {
  const row = useLiveQuery(async () => {
    const found = await transcriptRepository.get(clipId);
    return found ? { status: found.status, text: found.text } : null;
  }, [clipId]);
  return row ?? null;
}
