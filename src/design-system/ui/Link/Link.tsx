import type { ComponentPropsWithoutRef } from 'react';
import { Link as RouterLink } from 'react-router';

import './Link.css';

type LinkProps = Omit<ComponentPropsWithoutRef<'a'>, 'href'> & {
  /** An app route ("/settings") or a full address ("https://..."). */
  to: string;
};

/** Brand-coloured text link. Routes inside the app, a normal anchor for outside addresses. */
export function Link({ to, className, children, ...rest }: LinkProps) {
  const classes = ['ui-link', className].filter(Boolean).join(' ');
  if (/^(https?:|mailto:)/.test(to)) {
    return (
      <a {...rest} href={to} className={classes}>
        {children}
      </a>
    );
  }
  return (
    <RouterLink {...rest} to={to} className={classes}>
      {children}
    </RouterLink>
  );
}
