import { Fragment } from 'react';

import { rowDate, type Section } from '@/features/notes/list/groupItems';
import { LIST_COPY } from '@/features/notes/list/listContent';
import type { ListItem } from '@/features/notes/list/listItem';

import { ListRow } from './ListRow';
import { moveRowFocus } from './moveRowFocus';
import type { ListActions } from './useListActions';

interface NoteListRowsProps {
  sections: readonly Section[];
  now: number;
  /** The not-synced glyph shows for a pending note only while the device cannot reach the server. */
  offline: boolean;
  /** The path of the note that is open, for the selected row. */
  openPath: string;
  actions: ListActions;
  onOpen: (item: ListItem) => void;
}

/** The grouped rows (master 6.3). One list, group labels between the rows. */
export function NoteListRows({
  sections,
  now,
  offline,
  openPath,
  actions,
  onOpen,
}: NoteListRowsProps) {
  return (
    <div className="n-list" role="listbox" aria-label={LIST_COPY.listName} onKeyDown={moveRowFocus}>
      {sections.map(({ group, items }) => (
        <Fragment key={group}>
          <div className="n-group-label" role="presentation">
            {LIST_COPY.groups[group]}
          </div>
          {items.map((item) => (
            <ListRow
              key={item.id}
              item={item}
              date={rowDate(item, now)}
              selected={openPath === item.path}
              notSynced={item.failed || (item.pending && offline)}
              actions={actions}
              onOpen={() => {
                onOpen(item);
              }}
            />
          ))}
        </Fragment>
      ))}
    </div>
  );
}
