import { ListChecks, Mic } from 'lucide-react';
import type { ComponentProps } from 'react';

import { Menu } from '../Menu/Menu';

interface InsertMenuProps {
  onVoice?: (() => void) | undefined;
  onChecklist?: (() => void) | undefined;
  /** Draw the "+" trigger and spread triggerProps onto it, as for Menu. */
  children: ComponentProps<typeof Menu>['children'];
}

/** The "+" menu in the editor: Voice clip and Checklist. */
export function InsertMenu({ onVoice, onChecklist, children }: InsertMenuProps) {
  return (
    <Menu
      label="Insert"
      items={[
        {
          label: 'Voice clip',
          icon: Mic,
          onSelect: () => {
            onVoice?.();
          },
        },
        {
          label: 'Checklist',
          icon: ListChecks,
          onSelect: () => {
            onChecklist?.();
          },
        },
      ]}
    >
      {children}
    </Menu>
  );
}
