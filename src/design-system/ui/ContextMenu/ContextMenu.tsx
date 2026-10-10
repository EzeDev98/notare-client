import { Archive, Copy, LogOut, Pin, Trash2, Users } from 'lucide-react';
import type { ComponentProps } from 'react';

import { Menu } from '../Menu/Menu';
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
  children,
}: ContextMenuProps) {
  const copyText: MenuEntry = { label: 'Copy as text', icon: Copy, onSelect: run(onCopyText) };
  const makeCopy: MenuEntry = { label: 'Make a copy', icon: Copy, onSelect: run(onMakeCopy) };
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
          'separator',
          { label: 'Leave this note', icon: LogOut, onSelect: run(onLeave), danger: true },
        ];

  return (
    <Menu label="Note options" items={items}>
      {children}
    </Menu>
  );
}
