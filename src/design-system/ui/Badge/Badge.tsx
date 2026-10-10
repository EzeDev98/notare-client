import type { ReactNode } from 'react';

import './Badge.css';

interface BadgeProps {
  /** Sits on the top corner of a positioned parent such as an IconButton. */
  floating?: boolean | undefined;
  children: ReactNode;
}

/** A filled count. */
export function Badge({ floating = false, children }: BadgeProps) {
  return <span className={floating ? 'ui-badge ui-badge--floating' : 'ui-badge'}>{children}</span>;
}
