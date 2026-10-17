import { Menu } from 'lucide-react';
import type { ReactNode } from 'react';

import { IconButton } from '@/design-system/ui/IconButton/IconButton';

import { SHELL_COPY } from './shellContent';

interface ShellHeaderProps {
  onMenu: () => void;
  /** Receives the middle slot, where an open note puts its own controls on a wide screen. */
  slotRef?: ((element: HTMLElement | null) => void) | undefined;
  children?: ReactNode;
}

/** The 56px bar across both panes: the menu button, a slot for the open note's controls, and the actions. */
export function ShellHeader({ onMenu, slotRef, children }: ShellHeaderProps) {
  return (
    <header className="shell__bar">
      <IconButton icon={Menu} label={SHELL_COPY.openMenu} onClick={onMenu} />
      <div ref={slotRef} className="shell__bar-note" />
      <div className="shell__actions">{children}</div>
    </header>
  );
}
