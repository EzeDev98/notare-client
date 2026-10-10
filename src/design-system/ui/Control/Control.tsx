import type { ReactNode } from 'react';

import './Control.css';

interface ControlProps {
  invalid?: boolean | undefined;
  disabled?: boolean | undefined;
  readOnly?: boolean | undefined;
  /** Room for a button on the trailing side. */
  trailing?: boolean | undefined;
  multiline?: boolean | undefined;
  children: ReactNode;
}

/** The 40px bordered box every text-like field sits in. */
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
