import { Copy, Pin, RotateCcw, Trash2 } from 'lucide-react';
import type { ComponentProps } from 'react';

import { Menu } from '../Menu/Menu';
import type { PopoverPoint } from '../Popover/Popover';
import type { MenuEntry } from '../Menu/MenuList';

type Handler = (() => void) | undefined;

interface ContextMenuProps {
  /** list: the note list. editor: the editor screen (adds Copy as text). */
  where: 'list' | 'editor';
  pinned?: boolean | undefined;
  onPin?: Handler;
  onCopyText?: Handler;
  onMakeCopy?: Handler;
  /** Shown only when given: undoes AI tidy on this note (editor only). */
  onRestoreOriginal?: Handler;
  onDelete?: Handler;
  /** Open at a screen point (right-click, long-press). */
  point?: PopoverPoint | null | undefined;
  onPointClose?: (() => void) | undefined;
  /** Draw the trigger and spread triggerProps onto it, as for Menu. */
  children: ComponentProps<typeof Menu>['children'];
}

const run = (handler: Handler) => () => {
  handler?.();
};

/**
 * The note menu: Pin, Copy as text (editor only), Make a copy, Restore original
 * (only when given) and Delete.
 */
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
