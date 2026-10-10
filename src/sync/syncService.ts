import { httpClient } from '@/lib/http/client';
import type { SyncBatchResponse, SyncOperationRequest, SyncPullResponse } from '@/sync/types';

/**
 * Same shape as `noteService`: one place that knows the path, and nothing
 * here catches. A 500 propagates as `ApiError` and `push.ts` decides what it
 * means — "retry the whole batch, the ledger makes that safe" (architecture
 * doc) is a sync-engine decision, not an HTTP-layer one.
 */
export const syncService = {
  pushBatch(operations: SyncOperationRequest[]): Promise<SyncBatchResponse> {
    return httpClient.post<SyncBatchResponse>('/sync/batch', { body: { operations } });
  },

  /**
   * `since` omitted entirely (not sent as an empty string) triggers a first
   * sync — `buildQuery` drops `undefined` query values, which is why
   * `pull.ts` can pass the cursor straight through without a branch here.
   */
  pull(query: { since?: string; page: number; size: number }): Promise<SyncPullResponse> {
    return httpClient.get<SyncPullResponse>('/sync', { query });
  },
};
