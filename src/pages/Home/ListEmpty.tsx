/** What the list shows when there are no notes or no search results. */
import { Search } from 'lucide-react';

import { EmptyState } from '@/design-system/ui';
import { LIST_COPY } from '@/features/notes/list/listContent';

interface ListEmptyProps {
  term: string;
}

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

  return <EmptyState title={LIST_COPY.empty.all.title} />;
}
