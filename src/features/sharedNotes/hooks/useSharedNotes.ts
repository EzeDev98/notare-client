import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { sharedNoteService } from '@/features/sharedNotes/api/sharedNoteService';

/**
 * Query key factory. A function, not a constant array, so a mutation can
 * invalidate ['shared-notes', 'list'] (every page) without needing to know
 * which page a given screen is currently on.
 */
export const sharedNotesKeys = {
  all: ['shared-notes'] as const,
  lists: () => [...sharedNotesKeys.all, 'list'] as const,
  list: (page: number, size: number) => [...sharedNotesKeys.lists(), { page, size }] as const,
  details: () => [...sharedNotesKeys.all, 'detail'] as const,
  detail: (noteId: number) => [...sharedNotesKeys.details(), noteId] as const,
};

/**
 * The "Shared with me" list, zero-based to match `sharedNoteService`'s own
 * convention (and the server's Pageable underneath it).
 *
 * `placeholderData: keepPreviousData` keeps the current page's rows on
 * screen while the next page loads, rather than flashing a loading state
 * over content that is still valid — the query has changed key (a new page
 * number) but nothing about what the user is looking at has become wrong.
 */
export function useSharedNotes(page = 0, size = 20) {
  return useQuery({
    queryKey: sharedNotesKeys.list(page, size),
    queryFn: ({ signal }) => sharedNoteService.listSharedNotes({ page, size, signal }),
    placeholderData: keepPreviousData,
  });
}
