import { useQuery } from '@tanstack/react-query';

import { collaborationService } from '@/features/collaboration/api/collaborationService';

export const collaborationKeys = {
  all: ['collaborations'] as const,
  sent: () => [...collaborationKeys.all, 'sent'] as const,
  received: () => [...collaborationKeys.all, 'received'] as const,
};

/** Invitations/grants the current user sent as owner. */
export function useSentCollaborations() {
  return useQuery({
    queryKey: collaborationKeys.sent(),
    queryFn: ({ signal }) => collaborationService.listSent({ signal }),
  });
}

/** Invitations/grants the current user received as collaborator. */
export function useReceivedCollaborations() {
  return useQuery({
    queryKey: collaborationKeys.received(),
    queryFn: ({ signal }) => collaborationService.listReceived({ signal }),
  });
}
