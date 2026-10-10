import type { ReactNode } from 'react';

import { Avatar, type Tint } from '../Avatar/Avatar';
import { Button } from '../Button/Button';
import { Tag } from '../Tag/Tag';

import './PersonRow.css';

interface PersonRowProps {
  name: string;
  /** Shown as @username. Never an email. */
  username: string;
  tint: Tint;
  /** connected: a tag. pending: a tag and Cancel. result: Invite (a Find people result). */
  state?: 'connected' | 'pending' | 'result' | undefined;
  onInvite?: (() => void) | undefined;
  onCancel?: (() => void) | undefined;
  /** Replaces the right side, for example a role select or the word Owner. */
  trailing?: ReactNode;
}

/** A person: avatar, name, @username, and what you can do with them. */
export function PersonRow({ name, username, tint, state = 'connected', onInvite, onCancel, trailing }: PersonRowProps) {
  let right: ReactNode = trailing;
  if (!right && state === 'connected') right = <Tag>Connected</Tag>;
  else if (!right && state === 'pending')
    right = (
      <>
        <Tag>Pending</Tag>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </>
    );
  else if (!right)
    right = (
      <Button variant="secondary" onClick={onInvite}>
        Invite
      </Button>
    );

  return (
    <div className="n-person">
      <Avatar name={name} tint={tint} />
      <div className="n-person__text">
        <p className="n-person__name">{name}</p>
        <p className="n-person__email">{`@${username}`}</p>
      </div>
      {right}
    </div>
  );
}
