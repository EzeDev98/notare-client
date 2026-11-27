/** A menu opened from a button. */
import { useCallback, useRef, useState, type ReactNode } from 'react';

import { Popover, type PopoverPoint } from '../Popover/Popover';

import { MenuList, type MenuEntry } from './MenuList';

import './Menu.css';

export interface MenuTriggerProps {
  'aria-haspopup': 'menu';
  'aria-expanded': boolean;
  onClick: () => void;
}

interface MenuProps {
  label: string;
  items: readonly MenuEntry[];
  point?: PopoverPoint | null | undefined;
  onPointClose?: (() => void) | undefined;
  children: (state: { open: boolean; triggerProps: MenuTriggerProps }) => ReactNode;
}

export function Menu({ label, items, point, onPointClose, children }: MenuProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    onPointClose?.();
    if (restoreFocus) anchorRef.current?.querySelector<HTMLElement>('button, a[href]')?.focus();
  }, [onPointClose]);

  const dismiss = useCallback(() => {
    close(false);
  }, [close]);

  const triggerProps: MenuTriggerProps = {
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    onClick: () => {
      setOpen((value) => !value);
    },
  };

  return (
    <>
      <span ref={anchorRef} className="ui-menu-anchor">
        {children({ open, triggerProps })}
      </span>
      <Popover
        open={open || Boolean(point)}
        onClose={dismiss}
        anchorRef={anchorRef}
        align={point ? 'start' : 'end'}
        point={point}
      >
        <MenuList label={label} items={items} onClose={close} />
      </Popover>
    </>
  );
}
