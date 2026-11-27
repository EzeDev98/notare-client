/** Staggers the rows in the first time the list fills. */
import { useLayoutEffect, useRef, type RefObject } from 'react';

import { listFirstLoad } from '@/design-system/motion/patterns';

export function useFirstLoad(ready: boolean, container: RefObject<HTMLElement | null>): void {
  const played = useRef(false);

  useLayoutEffect(() => {
    const host = container.current;
    if (!ready || played.current || !host) return;
    played.current = true;
    listFirstLoad([...host.querySelectorAll('.n-row')]);
  }, [ready, container]);
}
