import { useEffect, useState } from 'react';

/**
 * Returns `value` after it has stopped changing for `delayMs`.
 *
 * DEBOUNCE, not throttle. Throttle emits at a fixed rate regardless — good for
 * scroll handlers, wrong for search, where only the value the user stopped on
 * matters. Debounce waits for a pause.
 *
 * A genuine effect: the timer is external to React, and the cleanup is not
 * optional. Without clearTimeout, every keystroke leaves a live timer that
 * fires later and sets state from a value the user has moved past — which is
 * the debounce doing the exact opposite of its job.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debounced;
}
