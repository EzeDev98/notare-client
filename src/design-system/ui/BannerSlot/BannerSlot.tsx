import type { ReactNode } from 'react';

import './BannerSlot.css';

/**
 * The reserved banner space under the header. It is always as tall as the
 * header bar, so a banner appearing or going never pushes the screen.
 * Pass the one banner that matters most, or nothing.
 */
export function BannerSlot({ children }: { children?: ReactNode }) {
  return <div className="n-banner-slot">{children}</div>;
}
