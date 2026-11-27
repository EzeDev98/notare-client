import { httpClient } from '@/lib/http/client';

/** `/user/me/ai-tidy`: the AI tidy opt-in. Online only; the server holds it. */
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
