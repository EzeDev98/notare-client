/** Environment variables the app reads. */
const missing: string[] = [];

function required(name: string, value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    missing.push(name);
    return '';
  }
  return trimmed;
}

const apiBaseUrl = required('VITE_API_BASE_URL', import.meta.env.VITE_API_BASE_URL);
const serverTimeZone = required('VITE_SERVER_TIME_ZONE', import.meta.env.VITE_SERVER_TIME_ZONE);

if (missing.length > 0) {
  throw new Error(
    `Missing required environment variable(s): ${missing.join(', ')}. ` +
      `Copy .env.example to .env.local and fill them in.`,
  );
}

export const env = Object.freeze({
  apiBaseUrl: apiBaseUrl.replace(/\/+$/, ''),

  serverTimeZone,

  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
  mode: import.meta.env.MODE,
});

export type Env = typeof env;
