/// <reference types="vite/client" />

/** Injected by Vite `define` from package.json (see vite.config.ts). */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** IndexedDB name. E2E builds use a separate database (".env.e2e"). */
  readonly VITE_DB_NAME?: string;
}
