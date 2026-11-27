/** A flag that turns on only after staying on for a while. */
import { useEffect, useState } from 'react';

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
