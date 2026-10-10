import { useCallback, useRef, useState, type ReactNode } from 'react';

import { Popover } from '../Popover/Popover';

import { MenuList, type MenuEntry } from './MenuList';

import './Menu.css';

export interface MenuTriggerProps {
  'aria-haspopup': 'menu';
  'aria-expanded': boolean;
  onClick: () => void;
}

interface MenuProps {
  /** Spoken name of the menu, for example "More". */
  label: string;
  items: readonly MenuEntry[];
  /** Draw the trigger (an IconButton or Button) and spread triggerProps onto it. */
  children: (state: { open: boolean; triggerProps: MenuTriggerProps }) => ReactNode;
}

/**
 * A dropdown menu. Opens under its trigger, arrow keys move, Enter chooses,
 * Escape closes and returns focus to the trigger, a click elsewhere closes.
 */
export function Menu({ label, items, children }: MenuProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) anchorRef.current?.querySelector<HTMLElement>('button, a[href]')?.focus();
  }, []);

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
      <Popover open={open} onClose={dismiss} anchorRef={anchorRef} align="end">
        <MenuList label={label} items={items} onClose={close} />
      </Popover>
    </>
  );
}
