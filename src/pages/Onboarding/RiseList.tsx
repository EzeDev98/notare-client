/** Cards that rise into place one after another. */
import { useLayoutEffect, useRef, type ReactNode } from 'react';

import { cardsRise } from '@/design-system/motion/patterns';

export function RiseList({ ordered = false, children }: { ordered?: boolean; children: ReactNode }) {
  const list = useRef<HTMLUListElement & HTMLOListElement>(null);

  useLayoutEffect(() => {
    const items = list.current ? [...list.current.children] : [];
    const running = cardsRise(items);
    return () => {
      running.forEach((a) => {
        a.cancel();
      });
    };
  }, []);

  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag ref={list} className="ob-list">
      {children}
    </Tag>
  );
}
