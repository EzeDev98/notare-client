import { KEEP_ALIVE_MS } from '@/core/config/timings';
import { env } from '@/lib/config/env';

/**
 * Render's free tier spins the backend down after a period with no inbound
 * requests, and the cold start on the next real request can take several
 * seconds. Pinging a cheap, unauthenticated server endpoint (GET /keep-alive,
 * see the server's KeepAliveController) keeps the instance warm while the app
 * is in use.
 *
 * Pings only while the tab is visible and the device is online (D-14): a
 * hidden tab stays quiet, and the ping restarts, straight away, when the tab
 * comes back or the connection returns.
 *
 * Deliberately fire-and-forget: a failed ping isn't something the rest of the
 * app needs to know about or recover from. Nothing is read from the response
 * and nothing is stored anywhere.
 *
 * LIMITATION, stated plainly: this only keeps the server warm while the app is
 * open and visible somewhere. It cannot stop a spin-down when nobody has the
 * app open at all; that needs an external scheduled pinger or a paid
 * always-on plan.
 */
export function startKeepAlive(): void {
  let timer: ReturnType<typeof setInterval> | null = null;

  const ping = (): void => {
    fetch(`${env.apiBaseUrl}/keep-alive`).catch(() => {
      // See the doc comment above: intentionally swallowed.
    });
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
