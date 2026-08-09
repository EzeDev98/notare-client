/// <reference types="vite/client" />

/**
 * Our environment variables, typed.
 *
 * Vite's own ImportMetaEnv carries an `[key: string]: any` index signature, so
 * every VITE_* read is `any` until declared here — a silent hole in the
 * strictness set up in 1B. Declared members take precedence over the index
 * signature.
 *
 * `string | undefined`, not `string`. A .env file that forgot the line is a
 * normal Tuesday, and typing it as `string` would be the compiler asserting
 * something nobody checked. lib/config/env.ts is where that check happens; this
 * declaration is only here so the check is written against a truthful type.
 */
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string | undefined;
  readonly VITE_SERVER_TIME_ZONE: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
