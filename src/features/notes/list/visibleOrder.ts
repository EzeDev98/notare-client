import { isTwoPane } from '@/shared/hooks/useBarSlot';

interface Entry {
  id: string;
  path: string;
}

/** The notes on screen in the list, top to bottom, published by the list pane. */
let shown: readonly Entry[] = [];

export function publishVisibleOrder(entries: readonly Entry[]): void {
  shown = entries;
}

/**
 * Where to go when the note `id` leaves the list: the note below it, else the one above, else nowhere.
 * Ask BEFORE the note is removed, because the list drops it a moment later. Wide screens only; on a
 * phone the list is the screen you return to.
 */
export function routeAfterRemoving(id: string): string | null {
  if (!isTwoPane()) return null;
  const at = shown.findIndex((entry) => entry.id === id);
  if (at === -1) return null;
  const next = shown[at + 1] ?? shown[at - 1];
  return next ? next.path : null;
}
