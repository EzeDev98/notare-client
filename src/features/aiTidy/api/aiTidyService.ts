/** Server calls for the AI tidy setting. */
import { httpClient } from '@/lib/http/client';

const PATH = '/user/me/ai-tidy';

export interface AiTidySetting {
  enabled: boolean;
}

interface Cancellable {
  signal?: AbortSignal;
}

export const aiTidyService = {
  get({ signal }: Cancellable = {}): Promise<AiTidySetting> {
    return httpClient.get<AiTidySetting>(PATH, { ...(signal ? { signal } : {}) });
  },

  set(enabled: boolean): Promise<AiTidySetting> {
    return httpClient.put<AiTidySetting>(PATH, { body: { enabled } });
  },
};
