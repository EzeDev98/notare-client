import { env } from '@/lib/config/env';

const KEEP_ALIVE_INTERVAL_MS = 3 * 60 * 1000;

/**
 * Render's free tier spins the backend down after a period with no inbound
 * requests, and the cold start on the next real request can take several
 * seconds. Pinging a cheap, unauthenticated server endpoint every 3
 * minutes (GET /keep-alive — see the server's KeepAliveController) keeps
 * the instance warm for as long as this app stays open.
 *
 * Deliberately fire-and-forget: a failed ping (offline, server briefly
 * unreachable) isn't something the rest of the app needs to know about or
 * recover from — it just tries again on the next tick. Nothing is read
 * from the response and nothing is stored anywhere.
 *
 * LIMITATION, stated plainly: this only keeps the server warm while the
 * app is open somewhere. It cannot stop a spin-down when nobody has the
 * app open at all — that needs an external scheduled pinger (e.g. a
 * cron-based uptime checker hitting the same endpoint) or Render's paid
 * always-on plan.
 */
export function startKeepAlive(): void {
  const ping = (): void => {
    fetch(`${env.apiBaseUrl}/keep-alive`).catch(() => {
      // See doc comment above — intentionally swallowed.
    });
  };

  ping();
  setInterval(ping, KEEP_ALIVE_INTERVAL_MS);
}
