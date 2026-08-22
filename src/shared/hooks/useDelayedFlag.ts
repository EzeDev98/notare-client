import { useEffect, useState } from 'react';

/**
 * Reports `active` truthfully the instant it turns false, but only reports
 * it as true once it has STAYED true for `delayMs` — the asymmetric
 * debounce a loading spinner (or any other "something slow is happening"
 * indicator) actually needs.
 *
 * `useDebouncedValue` delays BOTH directions equally, which is the wrong
 * shape here: a fetch that resolves in 40ms should never show a spinner at
 * all, but a spinner that IS already showing must disappear the instant
 * real data arrives, not linger for its own debounce window after the wait
 * is already over.
 */
export function useDelayedFlag(active: boolean, delayMs: number): boolean {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!active) {
      setRevealed(false);
      return;
    }

    const timer = setTimeout(() => {
      setRevealed(true);
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [active, delayMs]);

  return active && revealed;
}