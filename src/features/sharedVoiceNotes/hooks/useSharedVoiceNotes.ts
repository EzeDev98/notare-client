import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { sharedVoiceNoteService } from '@/features/sharedVoiceNotes/api/sharedVoiceNoteService';

/**
 * Query key factory. A function, not a constant array, mirrors
 * `sharedNotesKeys` — a mutation (or a future one) can invalidate every
 * page via `['shared-voice-notes', 'list']` without knowing which page a
 * given screen is on. No `details()`/`detail()` pair here: unlike
 * `sharedNotesKeys`, there's no permission-cache-scavenging hook that needs
 * to search cached list pages by id — see `types.ts` for why the voice side
 * doesn't have that gap.
 */
export const sharedVoiceNotesKeys = {
  all: ['shared-voice-notes'] as const,
  lists: () => [...sharedVoiceNotesKeys.all, 'list'] as const,
  list: (page: number, size: number) => [...sharedVoiceNotesKeys.lists(), { page, size }] as const,
  detail: (voiceNoteId: number) => [...sharedVoiceNotesKeys.all, 'detail', voiceNoteId] as const,
};

/**
 * The "Shared with me" list's voice half, zero-based to match
 * `sharedNoteService`'s own convention (and the server's `Pageable`
 * underneath it).
 *
 * `placeholderData: keepPreviousData`, same reasoning as `useSharedNotes`:
 * keeps the current page's rows on screen while the next page loads rather
 * than flashing a loading state over content that's still valid.
 */
export function useSharedVoiceNotes(page = 0, size = 20) {
  return useQuery({
    queryKey: sharedVoiceNotesKeys.list(page, size),
    queryFn: ({ signal }) => sharedVoiceNoteService.listSharedWithMe({ page, size, signal }),
    placeholderData: keepPreviousData,
  });
}
