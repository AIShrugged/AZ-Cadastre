import { execFileSync } from 'node:child_process';
import path from 'node:path';

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';

import { startRegister, type StartedRegister } from './register.js';

// Pinned rather than `latest`, for the same reason the verification set pins
// it: what this guards is that the migration history applies to an empty
// database, and a moving server version makes that a different question every
// run.
const POSTGRES_IMAGE = 'postgres:17-alpine';
const DATABASE = 'registry_test';

let container: StartedPostgreSqlContainer | undefined;
let register: StartedRegister | undefined;

/**
 * Named exports rather than a default: vitest reads a default export as the
 * whole globalSetup and drops a sibling `teardown`, which would leak both the
 * container and the process.
 */
export async function setup(project: TestProject): Promise<void> {
  const cwd = path.join(import.meta.dirname, '..', '..');

  container = await new PostgreSqlContainer(POSTGRES_IMAGE)
    .withDatabase(DATABASE)
    .start();

  const url = container.getConnectionUri();

  /*
   * `migrate deploy` and then the seed, in that order and both against the
   * empty container: the set is here to catch a migration the database rejects
   * and a seed that has drifted from the schema it writes into. Neither shows
   * up in a unit spec, and both would show up in production.
   */
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd,
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
  execFileSync(process.execPath, ['build/infrastructure/persistence/seed.js'], {
    cwd,
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });

  register = await startRegister({
    NODE_ENV: 'test',
    SERVICE_PORT: '3310',
    SERVICE_HOST: '127.0.0.1',
    LOG_LEVEL: process.env.LOG_LEVEL ?? 'silent',
    DATABASE_URL: url,
  });

  project.provide('baseUrl', register.baseUrl);
}

export async function teardown(): Promise<void> {
  await register?.stop();
  await container?.stop();
}

declare module 'vitest' {
  interface ProvidedContext {
    baseUrl: string;
  }
}
