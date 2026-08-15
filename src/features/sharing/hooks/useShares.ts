import { useQuery } from '@tanstack/react-query';

import { shareService } from '@/features/sharing/api/shareService';

export const shareKeys = {
  all: ['shares'] as const,
  forNote: (noteId: number) => [...shareKeys.all, noteId] as const,
};

/** Every grant on one note — the owner's manager page's only read. */
export function useShares(noteId: number) {
  return useQuery({
    queryKey: shareKeys.forNote(noteId),
    queryFn: ({ signal }) => shareService.listShares(noteId, { signal }),
  });
}
