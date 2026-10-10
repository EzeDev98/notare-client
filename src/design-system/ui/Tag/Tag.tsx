import type { ReactNode } from 'react';

import './Tag.css';

interface TagProps {
  tone?: 'neutral' | 'brand' | undefined;
  children: ReactNode;
}

/** A small outlined label such as "Pinned" or "Shared". */
export function Tag({ tone = 'neutral', children }: TagProps) {
  return <span className={tone === 'brand' ? 'ui-tag ui-tag--brand' : 'ui-tag'}>{children}</span>;
}
