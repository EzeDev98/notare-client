/**
 * The single point where environment variables enter the application.
 *
 * Nothing else reads import.meta.env. That is the whole design: one place to
 * look when config is wrong, one place to change when a variable is renamed,
 * and one place that can fail loudly instead of thirty places that fail
 * mysteriously.
 *
 * WITHOUT this module, a missing VITE_API_BASE_URL reads as undefined, becomes
 * the string "undefined" in a template literal, and the app fetches
 * "undefined/notes" — a 404 from a URL nobody wrote, surfacing at runtime in
 * whichever component happened to fetch first.
 *
 * SECURITY: every VITE_-prefixed variable is inlined into the bundle as a
 * string literal and is readable by anyone. Nothing secret belongs here, ever.
 * This is the opposite of application.properties, where config is server-side
 * and private.
 */

const missing: string[] = [];

/**
 * Records a missing variable rather than throwing, so one startup reports
 * ALL of them. Throwing on the first means fix, restart, discover the next.
 */
function required(name: string, value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    missing.push(name);
    return '';
  }
  return trimmed;
}

const apiBaseUrl = required('VITE_API_BASE_URL', import.meta.env.VITE_API_BASE_URL);

if (missing.length > 0) {
  // Thrown at MODULE LOAD, so the app refuses to start rather than starting
  // wrong. In dev this is Vite's error overlay; in production it is a blank
  // page with a precise console error — worse to look at than a broken app,
  // and far better than one that looks like it works.
  throw new Error(
    `Missing required environment variable(s): ${missing.join(', ')}. ` +
      `Copy .env.example to .env.local and fill them in.`,
  );
}

export const env = Object.freeze({
  /**
   * Base URL for the API, with any trailing slash removed so callers can
   * always join with a leading-slash path. Normalised once here rather than
   * defensively in every request.
   */
  apiBaseUrl: apiBaseUrl.replace(/\/+$/, ''),

  /** Vite's own build-time flags, re-exported so nothing else imports env directly. */
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
  mode: import.meta.env.MODE,
});

export type Env = typeof env;
