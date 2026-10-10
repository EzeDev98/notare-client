import type { LucideIcon } from 'lucide-react';

import './Icon.css';

interface IconProps {
  /** A Lucide icon component, imported by name from lucide-react. */
  icon: LucideIcon;
  /** Gives the icon a spoken name. Leave it out when text beside it says the same. */
  label?: string;
  className?: string;
}

/**
 * The one way to draw an icon. Size (18px) and stroke (1.4) come from
 * tokens in Icon.css, so no call site sets either.
 */
export function Icon({ icon: Glyph, label, className }: IconProps) {
  const classes = ['ui-icon', className].filter(Boolean).join(' ');
  return label ? (
    <Glyph className={classes} role="img" aria-label={label} />
  ) : (
    <Glyph className={classes} aria-hidden="true" />
  );
}
