import { useQuery } from '@tanstack/react-query';

import { userService } from '@/features/collaboration/api/userService';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Debounces the raw keystrokes, not the query itself — `useQuery`'s key
 * changes only after `useDebouncedValue` settles, so a fast typist never
 * fires a request per keystroke.
 *
 * `enabled: query.length > 0` skips the request for an empty query
 * entirely rather than relying on the server's "blank returns empty page"
 * behaviour (`userService.searchUsers`'s doc comment) — that behaviour is
 * still correct and still tested at the service layer, but there is no
 * reason to round-trip to the server to learn "no query" means "no
 * results" when the client already knows that before typing starts.
 */
export function useUserSearch(rawQuery: string) {
  const query = useDebouncedValue(rawQuery.trim(), SEARCH_DEBOUNCE_MS);

  return useQuery({
    queryKey: ['user-search', query],
    queryFn: ({ signal }) => userService.searchUsers(query, { signal }),
    enabled: query.length > 0,
  });
}
