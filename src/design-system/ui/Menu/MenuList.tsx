import type { LucideIcon } from 'lucide-react';
import { useEffect, useRef, type KeyboardEvent } from 'react';

import { Icon } from '../Icon/Icon';

import './Menu.css';

export interface MenuItem {
  label: string;
  icon?: LucideIcon | undefined;
  onSelect: () => void;
  disabled?: boolean | undefined;
  /** Draws the item in the error colour, for example Leave this note. */
  danger?: boolean | undefined;
}

export type MenuEntry = MenuItem | 'separator';

interface MenuListProps {
  label: string;
  items: readonly MenuEntry[];
  /** restoreFocus is true when the user chose an item or pressed Escape. */
  onClose: (restoreFocus: boolean) => void;
}

const ENABLED = '[role="menuitem"]:not([aria-disabled="true"])';

/** The open menu: 200px, 32px items, arrow keys, Escape, focus handled by the Menu. */
export function MenuList({ label, items, onClose }: MenuListProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(ENABLED)?.focus({ preventScroll: true });
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const nodes = [...event.currentTarget.querySelectorAll<HTMLElement>(ENABLED)];
    const index = nodes.findIndex((node) => node === document.activeElement);
    const go = (target: number) => {
      event.preventDefault();
      nodes[(target + nodes.length) % nodes.length]?.focus({ preventScroll: true });
    };
    if (event.key === 'ArrowDown') go(index + 1);
    else if (event.key === 'ArrowUp') go(index === -1 ? -1 : index - 1);
    else if (event.key === 'Home') go(0);
    else if (event.key === 'End') go(-1);
    else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose(true);
    } else if (event.key === 'Tab') onClose(false);
  };

  return (
    <div ref={listRef} className="n-menu" role="menu" aria-label={label} tabIndex={-1} onKeyDown={handleKeyDown}>
      {items.map((item, index) =>
        item === 'separator' ? (
          <div key={`rule-${String(index)}`} className="n-menu__rule" role="separator" />
        ) : (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            tabIndex={-1}
            className={item.danger ? 'n-menu__item n-menu__item--danger' : 'n-menu__item'}
            aria-disabled={item.disabled || undefined}
            onClick={() => {
              if (item.disabled) return;
              onClose(true);
              item.onSelect();
            }}
          >
            {item.icon ? <Icon icon={item.icon} /> : null}
            {item.label}
          </button>
        ),
      )}
    </div>
  );
}
