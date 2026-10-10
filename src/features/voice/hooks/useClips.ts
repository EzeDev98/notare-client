import { clipRepository } from '@/features/notes/local/clipRepository';
import type { ClipRow } from '@/features/notes/local/clipRow';
import { useStableLiveQuery as useLiveQuery } from '@/shared/hooks/useStableLiveQuery';

/** A note's clips, read from the device. Undefined while Dexie is answering. */
export function useClips(noteId: string | undefined): ClipRow[] | undefined {
  return useLiveQuery(async () => {
    if (noteId === undefined) return [];
    return clipRepository.listForNote(noteId);
  }, [noteId]);
}

/** How many clips each note has, keyed by the note's localId. */
export function useClipCounts(): Record<string, number> {
  return useLiveQuery(() => clipRepository.countsByNote(), [], {});
}
