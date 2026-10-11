import { Archive, Copy, LogOut, Pin, Trash2, Users } from 'lucide-react';
import type { ComponentProps } from 'react';

import { Menu } from '../Menu/Menu';
import type { PopoverPoint } from '../Popover/Popover';
import type { MenuEntry } from '../Menu/MenuList';

export type NoteRole = 'owner' | 'editor' | 'viewer';

type Handler = (() => void) | undefined;

interface ContextMenuProps {
  role: NoteRole;
  /** list: the note list (owner gets Share). editor: the editor screen (everyone gets Copy as text). */
  where: 'list' | 'editor';
  pinned?: boolean | undefined;
  archived?: boolean | undefined;
  onPin?: Handler;
  onShare?: Handler;
  onCopyText?: Handler;
  onMakeCopy?: Handler;
  onArchive?: Handler;
  onDelete?: Handler;
  onLeave?: Handler;
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
 * The note menu. The owner gets Pin, Share (list) or Copy as text (editor), Make a copy,
 * Archive and Delete. Everyone else gets Make a copy and Leave this note.
 */
export function ContextMenu({
  role,
  where,
  pinned,
  archived,
  onPin,
  onShare,
  onCopyText,
  onMakeCopy,
  onArchive,
  onDelete,
  onLeave,
  point,
  onPointClose,
  children,
}: ContextMenuProps) {
  const copyText: MenuEntry = { label: 'Copy as text', icon: Copy, onSelect: run(onCopyText) };
  const makeCopy: MenuEntry = { label: 'Make a copy', icon: Copy, onSelect: run(onMakeCopy) };
  // Without a handler the item is left out, so a feature that is switched off shows nothing.
  const leave: MenuEntry[] = onLeave
    ? ['separator', { label: 'Leave this note', icon: LogOut, onSelect: run(onLeave), danger: true }]
    : [];
  const items: MenuEntry[] =
    role === 'owner'
      ? [
          { label: pinned ? 'Unpin' : 'Pin', icon: Pin, onSelect: run(onPin) },
          where === 'list' ? { label: 'Share', icon: Users, onSelect: run(onShare) } : copyText,
          makeCopy,
          { label: archived ? 'Unarchive' : 'Archive', icon: Archive, onSelect: run(onArchive) },
          'separator',
          { label: 'Delete', icon: Trash2, onSelect: run(onDelete) },
        ]
      : [
          ...(where === 'editor' ? [copyText] : []),
          makeCopy,
          ...leave,
        ];

  return (
    <Menu label="Note options" items={items} point={point} onPointClose={onPointClose}>
      {children}
    </Menu>
  );
}
