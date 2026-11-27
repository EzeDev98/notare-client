/** A countdown in whole seconds. */
import { useCallback, useEffect, useRef, useState } from 'react';

export function useCountdown(initialSeconds = 0): { remaining: number; start: (seconds: number) => void } {
  const [remaining, setRemaining] = useState(initialSeconds);
  const deadlineRef = useRef<number | null>(null);

  const start = useCallback((seconds: number) => {
    deadlineRef.current = Date.now() + seconds * 1000;
    setRemaining(seconds);
  }, []);

  useEffect(() => {
    if (remaining <= 0) return;

    const id = setInterval(() => {
      const deadline = deadlineRef.current ?? Date.now() + remaining * 1000;
      deadlineRef.current = deadline;

      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) deadlineRef.current = null;
    }, 250);

    return () => {
      clearInterval(id);
    };
  }, [remaining]);

  return { remaining, start };
}
