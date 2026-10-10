import { Bell, Mic, Pin, Share2 } from 'lucide-react';

import { useTheme } from '@/app/providers/theme-context';
import {
  Avatar,
  Button,
  DeviceRow,
  DrawerContent,
  IconTile,
  NotificationRow,
  PersonRow,
  Tag,
  type Tint,
} from '@/design-system/ui';

import { Both } from './Both';

const TINTS: readonly Tint[] = [1, 2, 3, 4, 5, 6];

const NOOP = () => undefined;

const ITEMS = [
  { label: 'All notes', count: 128, current: true, onSelect: NOOP },
  { label: 'Shared with me', count: 6, onSelect: NOOP },
  { label: 'Archived', count: 4, onSelect: NOOP },
  { label: 'Recently deleted', count: 3, onSelect: NOOP },
  { label: 'Settings', onSelect: NOOP },
] as const;

/** Row 13: Avatar, IconTile, PersonRow, DeviceRow, NotificationRow, DrawerContent. */
export function Row13() {
  const { resolved } = useTheme();
  return (
    <>
      <h2 className="gallery-group">Row 13: people, devices, notifications, drawer</h2>

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
          <IconTile icon={Share2} />
          <IconTile icon={Bell} />
        </div>
      </Both>

      <Both title="PersonRow: connected, pending, search result, with a trailing tag">
        <div className="gallery-stack">
          <PersonRow name="Ada Obi" username="ada" tint={1} state="connected" />
          <PersonRow name="Tunde Bello" username="tunde" tint={2} state="pending" onCancel={NOOP} />
          <PersonRow name="Chidi Eze" username="chidi" tint={3} state="result" onInvite={NOOP} />
          <PersonRow name="Ngozi Okafor" username="ngozi" tint={4} trailing={<Tag>Editor</Tag>} />
        </div>
      </Both>

      <Both title="DeviceRow: this device and another one">
        <div className="gallery-stack">
          <DeviceRow name="MacBook Pro, Chrome" lastSeen="Active now" current />
          <DeviceRow name="iPhone, Safari" lastSeen="Last seen yesterday" onSignOut={NOOP} />
        </div>
      </Both>

      <Both title="NotificationRow: unread, read, with actions">
        <div className="gallery-stack">
          <NotificationRow text="@tunde shared Project plan with you" meta="2 min ago" onDismiss={NOOP} />
          <NotificationRow text="@chidi asked to connect" meta="Yesterday" unread={false} onDismiss={NOOP} />
          <NotificationRow
            text="@ngozi invited you to Trip ideas"
            meta="Oct 3"
            actions={
              <>
                <Button variant="primary">Accept</Button>
                <Button variant="ghost">Decline</Button>
              </>
            }
          />
        </div>
      </Both>

      <Both title="DrawerContent: online, offline with 3 waiting, syncing 2 notes">
        <div className="gallery-row">
          {([{ state: 'online' }, { state: 'offline', waiting: 3 }, { state: 'syncing', waiting: 2 }] as const).map(
            (sync) => (
              <div className="gallery-drawer" key={sync.state}>
                <DrawerContent
                  logoScheme={resolved}
                  name="Ada Obi"
                  email="ada@example.com"
                  tint={5}
                  items={ITEMS}
                  sync={sync}
                  onSignOut={NOOP}
                />
              </div>
            ),
          )}
        </div>
      </Both>
    </>
  );
}
