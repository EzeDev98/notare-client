/** A button that shows only an icon. */
import type { LucideIcon } from 'lucide-react';
import type { ComponentPropsWithoutRef } from 'react';

import { Badge } from '../Badge/Badge';
import { Icon } from '../Icon/Icon';

import './IconButton.css';

interface IconButtonProps extends Omit<ComponentPropsWithoutRef<'button'>, 'children' | 'aria-label'> {
  icon: LucideIcon;
  label: string;
  pressed?: boolean | undefined;
  badge?: string | number | undefined;
}

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
