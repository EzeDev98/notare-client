import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * Clearing a search puts the list back where it was. `remember` is called as
 * the first character is typed; when the search ends, the saved position is
 * restored once the full list is back on screen.
 */
export function useSearchScroll(
  pane: RefObject<HTMLElement | null>,
  searching: boolean,
  items: unknown,
): () => void {
  const saved = useRef<number | null>(null);
  const wasSearching = useRef(false);
  const itemsAtEnd = useRef<{ value: unknown } | null>(null);

  const remember = useCallback(() => {
    saved.current = pane.current?.scrollTop ?? null;
  }, [pane]);

  useLayoutEffect(() => {
    const element = pane.current;
    if (searching) {
      wasSearching.current = true;
      itemsAtEnd.current = null;
      return;
    }
    if (!wasSearching.current || !element) return;
    itemsAtEnd.current ??= { value: items };
    if (saved.current !== null) element.scrollTop = saved.current;
    if (items !== itemsAtEnd.current.value) wasSearching.current = false;
  }, [searching, items, pane]);

  return remember;
}
