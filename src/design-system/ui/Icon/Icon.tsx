/** An icon. */
import type { LucideIcon } from 'lucide-react';

import './Icon.css';

interface IconProps {
  icon: LucideIcon;
  label?: string;
  className?: string;
}

export function Icon({ icon: Glyph, label, className }: IconProps) {
  const classes = ['ui-icon', className].filter(Boolean).join(' ');
  return label ? (
    <Glyph className={classes} role="img" aria-label={label} />
  ) : (
    <Glyph className={classes} aria-hidden="true" />
  );
}
