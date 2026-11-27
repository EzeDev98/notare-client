import { Search } from 'lucide-react';

import { EmptyState } from '@/design-system/ui';
import { LIST_COPY } from '@/features/notes/list/listContent';

interface ListEmptyProps {
  /** The search term, or empty when nothing is being searched. */
  term: string;
}

/** Nothing to show: no matches for a search, or no notes yet (master 6.3). */
export function ListEmpty({ term }: ListEmptyProps) {
  if (term !== '') {
    return (
      <EmptyState
        icon={Search}
        title={LIST_COPY.empty.search(term)}
        description={LIST_COPY.empty.searchHint}
      />
    );
  }

  // Just the words. The editor pane carries the icon, the text and the button.
  return <EmptyState title={LIST_COPY.empty.all.title} />;
}
