/** A floating round action button. */
import type { LucideIcon } from 'lucide-react';
import type { ComponentPropsWithoutRef } from 'react';

import { Icon } from '../Icon/Icon';

import './FloatingAction.css';

interface FloatingActionProps
  extends Omit<ComponentPropsWithoutRef<'button'>, 'children' | 'aria-label'> {
  icon: LucideIcon;
  label: string;
}

export function FloatingAction({
  icon,
  label,
  type = 'button',
  className,
  ...rest
}: FloatingActionProps) {
  const classes = ['ui-fab', className].filter(Boolean).join(' ');
  return (
    <button {...rest} type={type} className={classes} aria-label={label} title={label}>
      <Icon icon={icon} />
    </button>
  );
}
