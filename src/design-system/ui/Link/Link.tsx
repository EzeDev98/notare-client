/** A link to an app route or a web address. */
import type { ComponentPropsWithoutRef } from 'react';
import { Link as RouterLink } from 'react-router';

import './Link.css';

type LinkProps = Omit<ComponentPropsWithoutRef<'a'>, 'href'> & {
  to: string;
};

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
