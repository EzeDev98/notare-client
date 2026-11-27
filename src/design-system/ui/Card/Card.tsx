/** A card that groups content. */
import type { ComponentPropsWithoutRef } from 'react';

import './Card.css';

interface CardProps extends ComponentPropsWithoutRef<'div'> {
  flush?: boolean | undefined;
}

export function Card({ flush = false, className, ...rest }: CardProps) {
  const classes = ['ui-card', flush && 'ui-card--flush', className].filter(Boolean).join(' ');
  return <div {...rest} className={classes} />;
}
