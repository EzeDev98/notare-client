/** The notes in their on-screen order, for picking the next note. */
import { isTwoPane } from '@/shared/hooks/useBarSlot';

interface Entry {
  id: string;
  path: string;
}

let shown: readonly Entry[] = [];

export function publishVisibleOrder(entries: readonly Entry[]): void {
  shown = entries;
}

export function routeAfterRemoving(id: string): string | null {
  if (!isTwoPane()) return null;
  const at = shown.findIndex((entry) => entry.id === id);
  if (at === -1) return null;
  const next = shown[at + 1] ?? shown[at - 1];
  return next ? next.path : null;
}
