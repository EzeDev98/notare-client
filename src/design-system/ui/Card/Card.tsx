import type { ComponentPropsWithoutRef } from 'react';

import './Card.css';

interface CardProps extends ComponentPropsWithoutRef<'div'> {
  /** No inner padding, for content that draws its own (the drawer). */
  flush?: boolean | undefined;
}

/** A bordered surface. */
export function Card({ flush = false, className, ...rest }: CardProps) {
  const classes = ['ui-card', flush && 'ui-card--flush', className].filter(Boolean).join(' ');
  return <div {...rest} className={classes} />;
}
