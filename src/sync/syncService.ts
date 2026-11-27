/** Server calls for sync. */
import { httpClient } from '@/lib/http/client';
import type { SyncBatchResponse, SyncOperationRequest, SyncPullResponse } from '@/sync/types';

export const syncService = {
  pushBatch(operations: SyncOperationRequest[]): Promise<SyncBatchResponse> {
    return httpClient.post<SyncBatchResponse>('/sync/batch', { body: { operations } });
  },

  pull(query: { since?: string; page: number; size: number }): Promise<SyncPullResponse> {
    return httpClient.get<SyncPullResponse>('/sync', { query });
  },
};
