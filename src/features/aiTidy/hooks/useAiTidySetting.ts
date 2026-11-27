import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { aiTidyService } from '@/features/aiTidy/api/aiTidyService';

const aiTidyKey = ['ai-tidy'] as const;

interface AiTidySettingState {
  /** Undefined until the server has answered, so the setting stays hidden while offline. */
  enabled: boolean | undefined;
  saving: boolean;
  setEnabled: (next: boolean) => void;
}

/**
 * The AI tidy opt-in on Settings > Sync and storage. Shows the server's value;
 * a failed change leaves it as it was.
 */
export function useAiTidySetting(): AiTidySettingState {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: aiTidyKey,
    queryFn: ({ signal }) => aiTidyService.get({ signal }),
  });

  const mutation = useMutation({
    mutationFn: (enabled: boolean) => aiTidyService.set(enabled),
    onSuccess: (setting) => {
      queryClient.setQueryData(aiTidyKey, setting);
    },
  });

  return {
    enabled: query.data?.enabled,
    saving: mutation.isPending,
    setEnabled: (next) => {
      mutation.mutate(next);
    },
  };
}
