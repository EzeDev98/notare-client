import { Archive, Pen, Search, Trash2, Users, type LucideIcon } from 'lucide-react';

import type { NotesView } from '@/app/routes';
import { useStartNote } from '@/app/shell/useStartNote';
import { Button, EmptyState } from '@/design-system/ui';
import { LIST_COPY } from '@/features/notes/list/listContent';

const ICONS = {
  all: Pen,
  shared: Users,
  archived: Archive,
  deleted: Trash2,
} as const satisfies Record<NotesView, LucideIcon>;

interface ListEmptyProps {
  view: NotesView;
  /** The search term, or empty when nothing is being searched. */
  term: string;
}

/** Nothing to show: no matches for a search, or the view itself is empty (master 6.3). */
export function ListEmpty({ view, term }: ListEmptyProps) {
  const startNote = useStartNote();

  if (term !== '') {
    return (
      <EmptyState
        icon={Search}
        title={LIST_COPY.empty.search(term)}
        description={LIST_COPY.empty.searchHint}
      />
    );
  }

  const { title, description } = LIST_COPY.empty[view];
  return (
    <EmptyState
      icon={ICONS[view]}
      title={title}
      description={description}
      action={
        view === 'all' ? (
          <Button variant="primary" onClick={startNote}>
            {LIST_COPY.empty.newNote}
          </Button>
        ) : undefined
      }
    />
  );
}
