/** The reserved space under the header that holds one banner. */
import type { ReactNode } from 'react';

import './BannerSlot.css';

export function BannerSlot({ children }: { children?: ReactNode }) {
  return <div className="n-banner-slot">{children}</div>;
}
