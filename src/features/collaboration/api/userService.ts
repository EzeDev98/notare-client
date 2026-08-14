import type { UserSummaryResponse } from '@/features/collaboration/types';
import { httpClient } from '@/lib/http/client';
import type { PagedResponse } from '@/lib/http/types';

/**
 * GET /user/search?q= — matches username, email, and full name; excludes
 * the caller themselves; returns UserSummaryResponse (no email).
 *
 * A BLANK QUERY RETURNS AN EMPTY PAGE, not everything — unlike note search,
 * where an empty query is the caller's own data. This is other people's
 * data, so "browse everyone" is not an operation this endpoint performs.
 * The client does not need to special-case this: sending `q: ''` already
 * gets an empty page back from the server, so `searchUsers` does not
 * short-circuit locally — one behaviour, one place, matching whatever the
 * server actually decides "blank" means rather than a client-side guess
 * that could drift from it.
 */

interface Cancellable {
  signal?: AbortSignal;
}

export const userService = {
  searchUsers(
    query: string,
    { signal }: Cancellable = {},
  ): Promise<PagedResponse<UserSummaryResponse>> {
    return httpClient.get<PagedResponse<UserSummaryResponse>>('/user/search', {
      query: { q: query },
      ...(signal ? { signal } : {}),
    });
  },
};
