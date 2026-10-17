import { Archive, Search, Trash2, Users, type LucideIcon } from 'lucide-react';

import type { NotesView } from '@/app/routes';
import { EmptyState } from '@/design-system/ui';
import { LIST_COPY } from '@/features/notes/list/listContent';

const ICONS = {
  shared: Users,
  archived: Archive,
  deleted: Trash2,
} as const satisfies Record<Exclude<NotesView, 'all'>, LucideIcon>;

interface ListEmptyProps {
  view: NotesView;
  /** The search term, or empty when nothing is being searched. */
  term: string;
}

/** Nothing to show: no matches for a search, or the view itself is empty (master 6.3). */
export function ListEmpty({ view, term }: ListEmptyProps) {
  if (term !== '') {
    return (
      <EmptyState
        icon={Search}
        title={LIST_COPY.empty.search(term)}
        description={LIST_COPY.empty.searchHint}
      />
    );
  }

  // Your own list: just the words. The editor pane carries the icon, the text and the button.
  if (view === 'all') {
    return <EmptyState title={LIST_COPY.empty.all.title} />;
  }

  const { title, description } = LIST_COPY.empty[view];
  return <EmptyState icon={ICONS[view]} title={title} description={description} />;
}
