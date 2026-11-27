/** A small outlined label. */
import type { ReactNode } from 'react';

import './Tag.css';

interface TagProps {
  tone?: 'neutral' | 'brand' | undefined;
  children: ReactNode;
}

export function Tag({ tone = 'neutral', children }: TagProps) {
  return <span className={tone === 'brand' ? 'ui-tag ui-tag--brand' : 'ui-tag'}>{children}</span>;
}
