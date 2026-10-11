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
  /** False in Recently deleted, where a row has Restore instead of a menu. */
  withMenu: boolean;
  actions: ListActions;
  onOpen: () => void;
}

/**
 * One row with its menu. The menu opens three ways: the visible more button,
 * right-click (a two-finger trackpad click too) and press-and-hold.
 */
export function ListRow({ item, date, selected, notSynced, withMenu, actions, onOpen }: ListRowProps) {
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
      shared={item.shared}
      voice={item.voice}
      notSynced={notSynced}
      matchedInTranscript={item.transcriptOnly}
      onOpen={withMenu ? onOpen : undefined}
      deleted={
        !withMenu && item.daysLeft !== null
          ? {
              daysLeft: Math.max(1, item.daysLeft),
              onRestore: () => {
                actions.restore(item);
              },
            }
          : undefined
      }
      rootProps={withMenu ? press : undefined}
      menu={
        withMenu ? (
          <ContextMenu
            role={item.role}
            where="list"
            pinned={item.pinned}
            archived={item.archived}
            onPin={() => {
              actions.pin(item);
            }}
            onShare={() => {
              actions.share(item);
            }}
            onMakeCopy={() => {
              actions.copy(item);
            }}
            onArchive={() => {
              actions.archive(item);
            }}
            onDelete={() => {
              actions.trash(item);
            }}
            onLeave={
              actions.leave
                ? () => {
                    actions.leave?.(item);
                  }
                : undefined
            }
            point={point}
            onPointClose={() => {
              setPoint(null);
            }}
          >
            {({ triggerProps }) => <IconButton icon={MoreHorizontal} label={LIST_COPY.rowMenu} {...triggerProps} />}
          </ContextMenu>
        ) : undefined
      }
    />
  );
}
