/** The box shared by every text-like field. */
import type { ReactNode } from 'react';

import './Control.css';

interface ControlProps {
  invalid?: boolean | undefined;
  disabled?: boolean | undefined;
  readOnly?: boolean | undefined;
  trailing?: boolean | undefined;
  multiline?: boolean | undefined;
  children: ReactNode;
}

export function Control({ invalid, disabled, readOnly, trailing, multiline, children }: ControlProps) {
  const classes = [
    'ui-control',
    invalid && 'ui-control--invalid',
    disabled && 'ui-control--disabled',
    readOnly && 'ui-control--readonly',
    trailing && 'ui-control--trailing',
    multiline && 'ui-control--multiline',
  ]
    .filter(Boolean)
    .join(' ');
  return <div className={classes}>{children}</div>;
}
