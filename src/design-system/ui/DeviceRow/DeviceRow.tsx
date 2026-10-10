import { Button } from '../Button/Button';
import '../PersonRow/PersonRow.css';
import { Tag } from '../Tag/Tag';

interface DeviceRowProps {
  /** For example "MacBook, Chrome". */
  name: string;
  /** For example "Active now" or "2 days ago". */
  lastSeen: string;
  /** This device: a tag instead of Sign out. */
  current?: boolean | undefined;
  onSignOut?: (() => void) | undefined;
}

/** A signed-in device with its last activity. */
export function DeviceRow({ name, lastSeen, current = false, onSignOut }: DeviceRowProps) {
  return (
    <div className="n-person">
      <div className="n-person__text">
        <p className="n-person__name">{name}</p>
        <p className="n-person__email">{lastSeen}</p>
      </div>
      {current ? (
        <Tag tone="brand">This device</Tag>
      ) : (
        <Button variant="secondary" onClick={onSignOut}>
          Sign out
        </Button>
      )}
    </div>
  );
}
