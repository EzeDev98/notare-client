import { useEffect, useState } from 'react';

/**
 * Whether the browser believes it has a network connection.
 *
 * A HINT, NOT THE TRUTH. navigator.onLine reports whether a network interface
 * is up — a laptop connected to a café router with a broken uplink reports
 * true. It can tell you reliably that you are OFFLINE; it cannot tell you that
 * you are online.
 *
 * So this is an optimisation on top of the real signal, which is a request
 * that failed. The editor treats `false` as immediate offline, and also enters
 * offline when a save returns a network error despite this saying true.
 *
 * A genuine effect: subscribing to browser events is synchronisation with an
 * external system, and the listeners must be removed or every mount leaks one.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const goOnline = (): void => {
      setOnline(true);
    };
    const goOffline = (): void => {
      setOnline(false);
    };

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    // Re-read on mount: the state may have changed between the initial render
    // and this effect running.
    setOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}
