/** Pings the server so it does not go to sleep. */
import { KEEP_ALIVE_MS } from '@/core/config/timings';
import { env } from '@/lib/config/env';

export function startKeepAlive(): void {
  let timer: ReturnType<typeof setInterval> | null = null;

  const ping = (): void => {
    fetch(`${env.apiBaseUrl}/keep-alive`).catch(() => {});
  };

  const update = (): void => {
    const active = document.visibilityState === 'visible' && navigator.onLine;
    if (active && timer === null) {
      ping();
      timer = setInterval(ping, KEEP_ALIVE_MS);
    } else if (!active && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };

  document.addEventListener('visibilitychange', update);
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}
