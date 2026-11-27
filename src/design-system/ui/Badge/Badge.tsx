/** A count badge on the corner of a button. */
import type { ReactNode } from 'react';

import './Badge.css';

interface BadgeProps {
  floating?: boolean | undefined;
  children: ReactNode;
}

export function Badge({ floating = false, children }: BadgeProps) {
  return <span className={floating ? 'ui-badge ui-badge--floating' : 'ui-badge'}>{children}</span>;
}
