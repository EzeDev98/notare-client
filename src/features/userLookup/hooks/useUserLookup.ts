import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { userLookupService } from '@/features/userLookup/api/userLookupService';
import type { UserSummaryResponse } from '@/features/userLookup/types';

/**
 * Query key factory. The key is the SORTED, DISTINCT id array itself —
 * not a page number or a filter — so two callers naming the same set of
 * ids in a different order (or a render that builds a fresh array each
 * time) hash to the same cache entry and share one request rather than
 * issuing duplicates. TanStack Query hashes keys by value, not reference,
 * so a fresh array literal here is not a cache-miss on its own.
 */
export const userLookupKeys = {
  all: ['user-lookup'] as const,
  batch: (ids: readonly number[]) => [...userLookupKeys.all, ids] as const,
};

interface UseUserLookupResult {
  /** id -> profile. Ids with no match (e.g. a deleted account) are simply
   * absent from the map — see `formatUserName` for how callers render that. */
  profiles: Map<number, UserSummaryResponse>;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Resolves a set of user ids to public profiles in ONE request, however
 * many rows on screen reference those ids — the four intended consumers
 * (Shared with me, Share Note, Invitations, Notifications) each pass every
 * id their current page needs, not one id per row.
 *
 * `null`/`undefined` entries are dropped silently rather than rejected: a
 * caller mapping `rows.map(r => r.ownerId)` over not-yet-loaded or
 * optional fields is the normal case, not an error.
 *
 * NOT chunked past the server's 100-id cap (`MAX_USER_LOOKUP_IDS`) — none
 * of the four intended consumers renders a page anywhere near that size.
 * If a future consumer can exceed it, that call site needs to chunk its
 * own ids across multiple `useUserLookup` calls; silently splitting one
 * logical batch into several requests here would hide that cost instead
 * of surfacing it where the large id set originates.
 */
export function useUserLookup(ids: ReadonlyArray<number | null | undefined>): UseUserLookupResult {
  const distinctIds = useMemo(() => {
    const set = new Set<number>();
    for (const id of ids) {
      if (id !== null && id !== undefined) set.add(id);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [ids]);

  const query = useQuery({
    queryKey: userLookupKeys.batch(distinctIds),
    queryFn: ({ signal }) => userLookupService.lookupUsers(distinctIds, { signal }),
    enabled: distinctIds.length > 0,
  });

  const profiles = useMemo(() => {
    const map = new Map<number, UserSummaryResponse>();
    for (const profile of query.data ?? []) {
      map.set(profile.id, profile);
    }
    return map;
  }, [query.data]);

  return {
    profiles,
    // `enabled: false` (empty id set) still reports isLoading under some
    // TanStack versions/configs — pinned to false explicitly so an empty
    // set renders as "done, nothing to show" rather than a spinner with
    // nothing to wait on.
    isLoading: distinctIds.length > 0 && query.isLoading,
    isError: query.isError,
  };
}

/**
 * `John Doe` -> fallback `@username` -> fallback `Unknown user`, so every
 * consumer (owner names on Shared with me's cards, Share Note's rows,
 * eventually Invitations/Notifications) renders a name identically instead
 * of each screen inventing its own fallback chain.
 *
 * Takes the resolved profile directly (or `undefined` for an id with no
 * match in `profiles`) rather than an id + the map, so a missing id and a
 * profile with blank names both fall through the same chain.
 */
export function formatUserName(profile: UserSummaryResponse | undefined): string {
  if (profile === undefined) return 'Unknown user';

  const fullName = `${profile.firstName} ${profile.lastName}`.trim();
  if (fullName !== '') return fullName;

  if (profile.username.trim() !== '') return `@${profile.username}`;

  return 'Unknown user';
}
