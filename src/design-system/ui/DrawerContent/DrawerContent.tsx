import { ChevronRight, type LucideIcon } from 'lucide-react';

import { Avatar, type Tint } from '../Avatar/Avatar';
import { Icon } from '../Icon/Icon';

import './DrawerContent.css';

interface DrawerItem {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
}

interface DrawerContentProps {
  name: string;
  email: string;
  tint: Tint;
  /** Rows that open a screen: Appearance, Sync and storage, About and legal. */
  items: readonly DrawerItem[];
  signOut: DrawerItem;
}

/** What goes inside the 280px drawer: who you are, three rows, Sign out. */
export function DrawerContent({ name, email, tint, items, signOut }: DrawerContentProps) {
  return (
    <>
      <div className="n-drawer__section">
        <Avatar name={name} tint={tint} />
        <div className="n-drawer__who">
          <p>{name}</p>
          <p>{email}</p>
        </div>
      </div>
      <nav className="n-drawer__nav" aria-label="Menu">
        {items.map((item) => (
          <button key={item.label} type="button" className="n-drawer__row" onClick={item.onSelect}>
            <Icon icon={item.icon} />
            <span className="n-drawer__label">{item.label}</span>
            <Icon icon={ChevronRight} className="n-drawer__chev" />
          </button>
        ))}
        <button type="button" className="n-drawer__row n-drawer__row--danger" onClick={signOut.onSelect}>
          <Icon icon={signOut.icon} />
          <span className="n-drawer__label">{signOut.label}</span>
        </button>
      </nav>
    </>
  );
}
