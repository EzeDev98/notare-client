import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A countdown in whole seconds, for resend cooldowns.
 *
 * Tracks a TARGET TIMESTAMP rather than decrementing a counter. An interval
 * that subtracts one per tick drifts — timers fire late, and a backgrounded
 * tab throttles them to once a minute, so a 60-second countdown can take five
 * minutes of wall clock. Computing the remaining time from a deadline is
 * correct regardless of when the tick actually happens.
 */
export function useCountdown(): { remaining: number; start: (seconds: number) => void } {
  const [remaining, setRemaining] = useState(0);
  const deadlineRef = useRef<number | null>(null);

  const start = useCallback((seconds: number) => {
    deadlineRef.current = Date.now() + seconds * 1000;
    setRemaining(seconds);
  }, []);

  useEffect(() => {
    if (remaining <= 0) return;

    const id = setInterval(() => {
      const deadline = deadlineRef.current;
      if (deadline === null) return;

      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) deadlineRef.current = null;
    }, 250);

    // Without this, an interval survives unmount and calls setState on a gone
    // component — a leak per mount, silent until it isn't.
    return () => {
      clearInterval(id);
    };
  }, [remaining]);

  return { remaining, start };
}
