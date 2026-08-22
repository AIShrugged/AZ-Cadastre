import { execFileSync } from 'node:child_process';
import path from 'node:path';

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';

// Pinned rather than `latest`: the set is here to catch a migration that the
// database rejects, and a moving server version would make that a different
// question every run.
const POSTGRES_IMAGE = 'postgres:17-alpine';
const DATABASE = 'verification_test';

let container: StartedPostgreSqlContainer | undefined;

export async function setup(project: TestProject): Promise<void> {
  container = await new PostgreSqlContainer(POSTGRES_IMAGE)
    .withDatabase(DATABASE)
    .start();

  const url = container.getConnectionUri();

  /*
   * `migrate deploy`, not `db push`: the point of the set is that the migration
   * history applies cleanly to an empty database, which is the one thing a
   * schema-diffing push would never tell us.
   */
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: path.join(import.meta.dirname, '..'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });

  project.provide('databaseUrl', url);
}

export async function teardown(): Promise<void> {
  await container?.stop();
}

declare module 'vitest' {
  interface ProvidedContext {
    databaseUrl: string;
  }
}
