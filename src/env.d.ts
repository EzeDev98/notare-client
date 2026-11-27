/// <reference types="vite/client" />
/** Type declarations for Vite's environment. */

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string | undefined;
  readonly VITE_SERVER_TIME_ZONE: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __APP_VERSION__: string;
