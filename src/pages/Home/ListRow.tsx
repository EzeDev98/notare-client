/** One list row with its menu. */
import { MoreHorizontal } from 'lucide-react';
import { useState } from 'react';

import { ContextMenu, IconButton, NoteRow } from '@/design-system/ui';
import type { PopoverPoint } from '@/design-system/ui/Popover/Popover';
import { LIST_COPY } from '@/features/notes/list/listContent';
import type { ListItem } from '@/features/notes/list/listItem';
import { useLongPressContextMenu } from '@/shared/hooks/useLongPressContextMenu';

import type { ListActions } from './useListActions';

interface ListRowProps {
  item: ListItem;
  date: string;
  selected: boolean;
  notSynced: boolean;
  actions: ListActions;
  onOpen: () => void;
}

export function ListRow({ item, date, selected, notSynced, actions, onOpen }: ListRowProps) {
  const [point, setPoint] = useState<PopoverPoint | null>(null);
  const press = useLongPressContextMenu((x, y) => {
    setPoint({ x, y });
  });

  return (
    <NoteRow
      title={item.title}
      preview={item.preview}
      date={date}
      selected={selected}
      pinned={item.pinned}
      voice={item.voice}
      notSynced={notSynced}
      matchedInTranscript={item.transcriptOnly}
      onOpen={onOpen}
      rootProps={press}
      menu={
        <ContextMenu
          where="list"
          pinned={item.pinned}
          onPin={() => {
            actions.pin(item);
          }}
          onMakeCopy={() => {
            actions.copy(item);
          }}
          onDelete={() => {
            actions.delete(item);
          }}
          point={point}
          onPointClose={() => {
            setPoint(null);
          }}
        >
          {({ triggerProps }) => <IconButton icon={MoreHorizontal} label={LIST_COPY.rowMenu} {...triggerProps} />}
        </ContextMenu>
      }
    />
  );
}
