/** Keeps the list's scroll position while it is hidden. */
import { useEffect, type RefObject } from 'react';

export function useKeepScroll(pane: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const element = pane.current;
    if (!element) return undefined;
    let top = 0;

    const remember = (): void => {
      if (element.clientHeight > 0) top = element.scrollTop;
    };
    const restore = new ResizeObserver(() => {
      if (element.clientHeight > 0 && element.scrollTop !== top) element.scrollTop = top;
    });

    element.addEventListener('scroll', remember, { passive: true });
    restore.observe(element);
    return () => {
      element.removeEventListener('scroll', remember);
      restore.disconnect();
    };
  }, [pane]);
}
