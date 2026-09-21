import type { ModuleMetadata } from '@nestjs/common';

/**
 * The configuration this context needs, as a shape rather than as environment
 * variables. The composition root reads and validates the environment once and
 * hands a slice of this shape in; nothing under `packages/` reads
 * `process.env`.
 */
export type AccountsModuleOptions = {
  database: {
    url: string;
  };
  /**
   * The two accounts the office starts with, so that a freshly brought-up stack
   * can be signed into.
   *
   * The addresses are not here and are not configurable: they are written into
   * the seeder, because they are documented in the README and named in the
   * compose file, and a deployment that changed one would have a stack nobody
   * could sign into and a runbook that says otherwise. What a deployment does
   * choose is the password.
   *
   * `undefined` is the honest default and means: do not seed that account.
   * A default written into the schema would be a password published in this
   * repository and in force on any stand whose operator did not think to
   * override it.
   */
  seed: {
    operatorPassword: string | undefined;
    userPassword: string | undefined;
  };
};

/** How `AccountsModule.forRootAsync` is handed that shape. */
export type AccountsModuleAsyncOptions = Pick<ModuleMetadata, 'imports'> & {
  inject?: unknown[];
  useFactory: (
    ...args: never[]
  ) => AccountsModuleOptions | Promise<AccountsModuleOptions>;
};

/** Injection token for the resolved options. */
export const ACCOUNTS_OPTIONS = 'ACCOUNTS_OPTIONS';
