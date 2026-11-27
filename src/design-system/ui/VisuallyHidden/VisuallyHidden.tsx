/** Text for screen readers that takes no room on screen. */
import type { ReactNode } from 'react';

import './VisuallyHidden.css';

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="ui-visually-hidden">{children}</span>;
}
