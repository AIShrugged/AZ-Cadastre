/// <reference types="vite/client" />

/**
 * The environment the built bundle carries. Declared so a missing variable is a
 * type error at the one place that reads it rather than `undefined` at runtime.
 */
interface ImportMetaEnv {
  /**
   * Where the browser reaches the archive register. Defaults to the `/registry`
   * prefix the dev server proxies (see `vite.config.ts`); set it only for a
   * deployment that serves the register on another origin — which is also the
   * deployment that has to put something in front of it (ADR-0011, TECH_DEBT §10).
   */
  readonly VITE_REGISTRY_BASE?: string;
}
