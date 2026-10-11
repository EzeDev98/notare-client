import { useLayoutEffect, useRef, type RefObject } from 'react';

import { listFirstLoad } from '@/design-system/motion/patterns';

/**
 * Rows stagger in the first time the list has any, and never again: not on a
 * refresh, not when the view changes. Reduced motion is handled in the motion module.
 */
export function useFirstLoad(ready: boolean, container: RefObject<HTMLElement | null>): void {
  const played = useRef(false);

  useLayoutEffect(() => {
    const host = container.current;
    if (!ready || played.current || !host) return;
    played.current = true;
    listFirstLoad([...host.querySelectorAll('.n-row')]);
  }, [ready, container]);
}
