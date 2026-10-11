import { Menu } from 'lucide-react';
import type { ReactNode } from 'react';

import { IconButton } from '@/design-system/ui/IconButton/IconButton';

import { SHELL_COPY } from './shellContent';

/** The 56px bar across both panes: the menu button on the left, the actions passed in on the right. */
export function ShellHeader({ onMenu, children }: { onMenu: () => void; children?: ReactNode }) {
  return (
    <header className="shell__bar">
      <IconButton icon={Menu} label={SHELL_COPY.openMenu} onClick={onMenu} />
      <div className="shell__actions">{children}</div>
    </header>
  );
}
