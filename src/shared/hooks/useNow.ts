/** The current time, refreshed when the tab comes back. */
import { useEffect, useState } from 'react';

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
