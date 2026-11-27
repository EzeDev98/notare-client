/** A note's context menu. */
import { Copy, Pin, RotateCcw, Trash2 } from 'lucide-react';
import type { ComponentProps } from 'react';

import { Menu } from '../Menu/Menu';
import type { PopoverPoint } from '../Popover/Popover';
import type { MenuEntry } from '../Menu/MenuList';

type Handler = (() => void) | undefined;

interface ContextMenuProps {
  where: 'list' | 'editor';
  pinned?: boolean | undefined;
  onPin?: Handler;
  onCopyText?: Handler;
  onMakeCopy?: Handler;
  onRestoreOriginal?: Handler;
  onDelete?: Handler;
  point?: PopoverPoint | null | undefined;
  onPointClose?: (() => void) | undefined;
  children: ComponentProps<typeof Menu>['children'];
}

const run = (handler: Handler) => () => {
  handler?.();
};

export function ContextMenu({
  where,
  pinned,
  onPin,
  onCopyText,
  onMakeCopy,
  onRestoreOriginal,
  onDelete,
  point,
  onPointClose,
  children,
}: ContextMenuProps) {
  const items: MenuEntry[] = [
    { label: pinned ? 'Unpin' : 'Pin', icon: Pin, onSelect: run(onPin) },
    ...(where === 'editor'
      ? [{ label: 'Copy as text', icon: Copy, onSelect: run(onCopyText) } satisfies MenuEntry]
      : []),
    { label: 'Make a copy', icon: Copy, onSelect: run(onMakeCopy) },
    ...(onRestoreOriginal
      ? [
          {
            label: 'Restore original',
            icon: RotateCcw,
            onSelect: run(onRestoreOriginal),
          } satisfies MenuEntry,
        ]
      : []),
    'separator',
    { label: 'Delete', icon: Trash2, onSelect: run(onDelete) },
  ];

  return (
    <Menu label="Note options" items={items} point={point} onPointClose={onPointClose}>
      {children}
    </Menu>
  );
}
