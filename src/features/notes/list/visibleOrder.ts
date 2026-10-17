import { ROUTES, type NotesView } from '@/app/routes';
import { isTwoPane } from '@/shared/hooks/useBarSlot';

interface Entry {
  id: string;
  path: string;
}

/** The notes on screen in the list, top to bottom, published by the list pane. */
let shown: { view: NotesView; entries: readonly Entry[] } = { view: 'all', entries: [] };

export function publishVisibleOrder(view: NotesView, entries: readonly Entry[]): void {
  shown = { view, entries };
}

/**
 * Where to go when the note `id` leaves the list: the note below it, else the one above, else nowhere.
 * Ask BEFORE the note is removed, because the list drops it a moment later. Wide screens only; on a
 * phone the list is the screen you return to.
 */
export function routeAfterRemoving(id: string): string | null {
  if (!isTwoPane()) return null;
  const at = shown.entries.findIndex((entry) => entry.id === id);
  if (at === -1) return null;
  const next = shown.entries[at + 1] ?? shown.entries[at - 1];
  return next ? ROUTES.inView(next.path, shown.view) : null;
}
