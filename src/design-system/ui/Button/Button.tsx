import type { ComponentPropsWithoutRef, MouseEvent, ReactNode } from 'react';
import { Link } from 'react-router';

import { Spinner } from '../Spinner/Spinner';

import './Button.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends Omit<ComponentPropsWithoutRef<'button'>, 'children'> {
  variant?: Variant;
  /** Full width, 42px tall. */
  block?: boolean;
  /** Keeps the label (hidden, so the width never changes) and shows a spinner. */
  busy?: boolean;
  /** Renders a router link that looks like this button. */
  to?: string;
  children: ReactNode;
}

/**
 * The one button. Four variants, 32px tall (42px when block).
 * Busy is not disabled: it keeps focus, ignores clicks and says so with aria-busy.
 */
export function Button({
  variant = 'secondary',
  block = false,
  busy = false,
  to,
  type = 'button',
  className,
  onClick,
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    'ui-button',
    `ui-button--${variant}`,
    block && 'ui-button--block',
    busy && 'ui-button--busy',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      <span className="ui-button__label">{children}</span>
      {busy ? <Spinner decorative size="sm" className="ui-button__spinner" /> : null}
    </>
  );

  if (to !== undefined) {
    return (
      <Link to={to} className={classes} aria-busy={busy || undefined}>
        {content}
      </Link>
    );
  }

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (busy) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  return (
    <button {...rest} type={type} className={classes} aria-busy={busy || undefined} onClick={handleClick}>
      {content}
    </button>
  );
}
