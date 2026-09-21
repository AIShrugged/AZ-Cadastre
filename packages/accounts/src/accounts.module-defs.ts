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
   * The logins are not here and are not configurable: they are written into the
   * seeder, because they are documented in the README and named in the compose
   * file, and a deployment that changed one would have a stack nobody could
   * sign into and a runbook that says otherwise. What a deployment does choose
   * is the password.
   *
   * `DEFAULT_SEED_PASSWORD` is what arrives when nothing was configured, and
   * that is deliberate: a fresh clone has to produce a stack somebody can sign
   * into with no `.env` to edit first, because the alternative — a stand that
   * migrated and seeded nothing — is diagnosed at the sign-in screen by
   * somebody who has no reason to suspect the environment. The cost is a
   * password published in this repository, so the seeder says so out loud at
   * start-up and names the variable that replaces it.
   */
  seed: {
    operatorPassword: string;
    userPassword: string;
  };
};

/** How `AccountsModule.forRootAsync` is handed that shape. */
export type AccountsModuleAsyncOptions = Pick<ModuleMetadata, 'imports'> & {
  inject?: unknown[];
  useFactory: (
    ...args: never[]
  ) => AccountsModuleOptions | Promise<AccountsModuleOptions>;
};

/**
 * The password both seeded accounts are opened with when the environment names
 * none.
 *
 * Published here rather than in the composition root because two places need
 * the same string: the environment schema, which defaults to it, and the
 * seeder, which recognises it in order to warn. It clears
 * `PASSWORD_MIN_LENGTH` — which is eight, and is eight because of this.
 */
export const DEFAULT_SEED_PASSWORD = '12345678';

/** Injection token for the resolved options. */
export const ACCOUNTS_OPTIONS = 'ACCOUNTS_OPTIONS';
