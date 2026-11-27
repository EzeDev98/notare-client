/** The header bar of the signed-in shell. */
import { Menu } from 'lucide-react';
import type { ReactNode } from 'react';

import { IconButton } from '@/design-system/ui/IconButton/IconButton';

import { SHELL_COPY } from './shellContent';

interface ShellHeaderProps {
  onMenu: () => void;
  slotRef?: ((element: HTMLElement | null) => void) | undefined;
  children?: ReactNode;
}

export function ShellHeader({ onMenu, slotRef, children }: ShellHeaderProps) {
  return (
    <header className="shell__bar">
      <IconButton icon={Menu} label={SHELL_COPY.openMenu} onClick={onMenu} />
      <div ref={slotRef} className="shell__bar-note" />
      <div className="shell__actions">{children}</div>
    </header>
  );
}
