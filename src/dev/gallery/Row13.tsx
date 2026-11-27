/** Gallery row: Avatar, IconTile, NotificationRow, DrawerContent. */
import { Bell, Contrast, Info, LogOut, Mic, Pin, RefreshCw } from 'lucide-react';

import {
  Avatar,
  Button,
  DrawerContent,
  IconTile,
  NotificationRow,
  type Tint,
} from '@/design-system/ui';

import { Both } from './Both';

const TINTS: readonly Tint[] = [1, 2, 3, 4, 5, 6];

const NOOP = () => undefined;

export function Row13() {
  return (
    <>
      <h2 className="gallery-group">Row 13: avatar, notifications, drawer</h2>

      <Both title="Avatar: six tints">
        <div className="gallery-row">
          {TINTS.map((tint) => (
            <Avatar key={tint} name="Ada" tint={tint} />
          ))}
        </div>
      </Both>

      <Both title="IconTile">
        <div className="gallery-row">
          <IconTile icon={Mic} />
          <IconTile icon={Pin} />
          <IconTile icon={Bell} />
        </div>
      </Both>

      <Both title="NotificationRow: unread, read, with actions">
        <div className="gallery-stack">
          <NotificationRow text="Transcript ready" meta="Transcript · 2 min ago" onDismiss={NOOP} />
          <NotificationRow text="Transcript ready" meta="Transcript · Yesterday" unread={false} onDismiss={NOOP} />
          <NotificationRow
            text="Could not transcribe a clip"
            meta="Transcript · Oct 3"
            actions={<Button variant="secondary">Retry</Button>}
          />
        </div>
      </Both>

      <Both title="DrawerContent">
        <div className="gallery-drawer">
          <DrawerContent
            name="Ada Obi"
            email="ada@example.com"
            tint={5}
            items={[
              { label: 'Appearance', icon: Contrast, onSelect: NOOP },
              { label: 'Sync and storage', icon: RefreshCw, onSelect: NOOP },
              { label: 'About and legal', icon: Info, onSelect: NOOP },
            ]}
            signOut={{ label: 'Sign out', icon: LogOut, onSelect: NOOP }}
          />
        </div>
      </Both>
    </>
  );
}
