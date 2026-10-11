import { useEffect, useState } from 'react';

/**
 * The current time as a render input. It refreshes when the tab regains focus
 * or becomes visible, which is when a day boundary could have been crossed.
 */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const refresh = (): void => {
      setNow(Date.now());
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  return now;
}
