import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

/**
 * TanStack Query, scoped to the domains that are genuinely server-truth with
 * no local copy to reconcile against: sharing, collaboration, notifications.
 * See ADR-0009 for the full reasoning.
 *
 * NOT for notes. Notes' source of truth is Dexie, read live via
 * `useLiveQuery` — layering a second cache over IndexedDB for the same data
 * produces two caches that can disagree, and every write would need to be
 * mirrored into both (NOTARE-CLIENT-ARCHITECTURE.md §3.4). The online-only
 * domains have no local copy at all, so there is exactly one cache to keep
 * coherent here — which is what TanStack Query is actually for.
 */

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // These domains are online-only; a failed request during an outage
        // should surface as an error state for the caller to act on, not
        // retry silently into a UI that looks like it is still loading.
        retry: false,
        // Catches a share or notification that arrived while the tab was
        // backgrounded, without polling on a timer nothing has asked for
        // yet. There is no push/SSE (G8) — "polling is the answer for v1"
        // is a decision for the domains that actually need it (e.g. an
        // unread count), not a default forced onto every query here.
        refetchOnWindowFocus: true,
      },
    },
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  // Created once via the lazy initializer, not once per render — the same
  // reasoning ThemeProvider gives for useState(() => value) over
  // useState(value): a fresh QueryClient on every render would silently
  // discard the cache it exists to provide.
  const [client] = useState(createQueryClient);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
