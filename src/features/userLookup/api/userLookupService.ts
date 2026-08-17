import type { UserSummaryResponse } from '@/features/userLookup/types';
import { httpClient } from '@/lib/http/client';

/**
 * GET /user/lookup?ids=... — resolves a batch of user ids to public
 * profiles in one request (UserController#lookupUsers). Returns a bare
 * array, not a PagedResponse: the caller already knows how many results it
 * can possibly get back, since it supplied the ids itself — an envelope
 * would just wrap a set the client already defined.
 *
 * NOT deduped or batched here — that's `useUserLookup`'s job. This is a
 * thin, single-request wrapper: whatever ids are passed go straight into
 * one `?ids=` query, one call.
 *
 * The server caps a single request at 100 ids (`MAX_USER_LOOKUP_IDS`) and
 * 400s on more, on an empty list, or on a list that dedupes to empty (all
 * nulls). Not re-validated here: the server already reports which case it
 * hit, and duplicating the cap client-side would be a second place it needs
 * to be kept in sync with `GeneralConstant.MAX_USER_LOOKUP_IDS`.
 */

interface Cancellable {
  signal?: AbortSignal;
}

export const userLookupService = {
  lookupUsers(ids: number[], { signal }: Cancellable = {}): Promise<UserSummaryResponse[]> {
    return httpClient.get<UserSummaryResponse[]>('/user/lookup', {
      query: { ids },
      ...(signal ? { signal } : {}),
    });
  },
};
