import { noteCount } from '@/design-system/lib/noteCount';

import { Avatar, type Tint } from '../Avatar/Avatar';
import { Button } from '../Button/Button';
import '../Button/Button.css';
import { Logo } from '../Logo/Logo';
import { Tag } from '../Tag/Tag';

import './DrawerContent.css';

interface DrawerItem {
  label: string;
  /** A count tag on the right. Leave out for Settings. */
  count?: number | undefined;
  current?: boolean | undefined;
  onSelect: () => void;
}

interface DrawerContentProps {
  /** The Logo image to use. The screen passes the resolved theme. */
  logoScheme: 'light' | 'dark';
  name: string;
  email: string;
  tint: Tint;
  /** Text-only rows: All notes, Shared with me, Archived, Recently deleted, Settings. */
  items: readonly DrawerItem[];
  sync: { state: 'online' | 'offline' | 'syncing'; waiting?: number | undefined };
  onSignOut: () => void;
}

function syncText(sync: DrawerContentProps['sync']): string {
  const waiting = sync.waiting ?? 0;
  if (sync.state === 'offline') return waiting > 0 ? `Offline. ${noteCount(waiting)} waiting to sync` : 'Offline';
  if (sync.state === 'syncing') return `Syncing ${noteCount(waiting)}`;
  return 'All notes synced';
}

/** What goes inside the 280px drawer: logo, who you are, the five rows, the sync line, Sign out. */
export function DrawerContent({ logoScheme, name, email, tint, items, sync, onSignOut }: DrawerContentProps) {
  return (
    <>
      <div className="n-drawer__section">
        <Logo scheme={logoScheme} />
        <div className="n-drawer__who">
          <Avatar name={name} tint={tint} />
          <div>
            <p>{name}</p>
            <p>{email}</p>
          </div>
        </div>
      </div>
      <nav className="n-drawer__nav" aria-label="Menu">
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            className="ui-button ui-button--ghost"
            aria-current={item.current ? 'page' : undefined}
            onClick={item.onSelect}
          >
            <span className="ui-button__label">{item.label}</span>
            {item.count === undefined ? null : (
              <span className="n-drawer__count">
                <Tag>{String(item.count)}</Tag>
              </span>
            )}
          </button>
        ))}
      </nav>
      <p className="n-drawer__sync" role="status">
        {syncText(sync)}
      </p>
      <div className="n-drawer__signout">
        <Button variant="secondary" block onClick={onSignOut}>
          Sign out
        </Button>
      </div>
    </>
  );
}
