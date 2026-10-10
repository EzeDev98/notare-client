import type { LucideIcon } from 'lucide-react';
import type { ComponentPropsWithoutRef } from 'react';

import { Badge } from '../Badge/Badge';
import { Icon } from '../Icon/Icon';

import './IconButton.css';

interface IconButtonProps extends Omit<ComponentPropsWithoutRef<'button'>, 'children' | 'aria-label'> {
  icon: LucideIcon;
  /** Required: an icon alone has no name for a screen reader. */
  label: string;
  /** For toggles. Shows the pressed look and sets aria-pressed. */
  pressed?: boolean | undefined;
  /** A count shown on the top corner, for example unread notifications. */
  badge?: string | number | undefined;
}

/** 32px icon button with a 6px invisible hit-area extension on every side. */
export function IconButton({ icon, label, pressed, badge, type = 'button', className, ...rest }: IconButtonProps) {
  const classes = ['ui-icon-button', className].filter(Boolean).join(' ');
  const name = badge === undefined ? label : `${label}, ${String(badge)}`;
  return (
    <button {...rest} type={type} className={classes} aria-label={name} aria-pressed={pressed}>
      <Icon icon={icon} />
      {badge === undefined ? null : <Badge floating>{badge}</Badge>}
    </button>
  );
}
