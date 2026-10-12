import { ListChecks, Mic } from 'lucide-react';
import type { ComponentProps } from 'react';

import { Menu } from '../Menu/Menu';
import type { MenuEntry } from '../Menu/MenuList';

interface InsertMenuProps {
  onVoice?: (() => void) | undefined;
  onChecklist?: (() => void) | undefined;
  /** Draw the "+" trigger and spread triggerProps onto it, as for Menu. */
  children: ComponentProps<typeof Menu>['children'];
}

/**
 * The "+" menu in the editor: Voice clip and Checklist. Without a handler an
 * item is left out, so a feature that is not built yet shows nothing.
 */
export function InsertMenu({ onVoice, onChecklist, children }: InsertMenuProps) {
  const items: MenuEntry[] = [];
  if (onVoice) items.push({ label: 'Voice clip', icon: Mic, onSelect: onVoice });
  if (onChecklist) items.push({ label: 'Checklist', icon: ListChecks, onSelect: onChecklist });

  return (
    <Menu label="Insert" items={items}>
      {children}
    </Menu>
  );
}
