import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { shouldRetry } from '@/app/providers/queryRules';
import { QUERY_STALE_MS } from '@/core/config/timings';

/**
 * The one TanStack Query client, scoped to the online-only domains: people,
 * notifications, shares, devices. See ADR-0009 for the full reasoning.
 *
 * NOT for notes. Notes' source of truth is Dexie, read live via
 * `useLiveQuery` — layering a second cache over IndexedDB for the same data
 * produces two caches that can disagree, and every write would need to be
 * mirrored into both (NOTARE-CLIENT-ARCHITECTURE.md §3.4).
 *
 * Data rules (master 9.5):
 *   - Data stays fresh for 30 seconds (QUERY_STALE_MS).
 *   - Retry only a transient failure (no connection, timeout, 5xx), at most
 *     twice. A 4xx never retries: asking again gets the same answer.
 *   - Refetch when the window regains focus, so a share or notification that
 *     arrived while the tab was in the background shows up. There is no push
 *     (G8), so a timer is used only where a screen needs one (unread count).
 *   - A spinner means `isPending` (nothing to show yet). Never `isFetching`:
 *     a background refetch keeps the old data on screen and changes nothing
 *     else, so the layout never moves. Disable a control during a refetch if
 *     you must; do not swap content for a spinner.
 */

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: QUERY_STALE_MS,
        retry: shouldRetry,
        refetchOnWindowFocus: true,
      },
    },
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  // Created once via the lazy initializer, not once per render: a fresh
  // QueryClient on every render would silently discard the cache.
  const [client] = useState(createQueryClient);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
