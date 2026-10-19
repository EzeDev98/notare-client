import type { LucideIcon } from 'lucide-react';
import type { ComponentPropsWithoutRef } from 'react';

import { Icon } from '../Icon/Icon';

import './FloatingAction.css';

interface FloatingActionProps
  extends Omit<ComponentPropsWithoutRef<'button'>, 'children' | 'aria-label'> {
  icon: LucideIcon;
  /** Required: an icon alone has no name for a screen reader. Also the hover tooltip. */
  label: string;
}

/**
 * A round icon-only button fixed to the bottom-right corner of the window. It
 * never scrolls with the page. Render it where the screen's one main action lives.
 */
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
