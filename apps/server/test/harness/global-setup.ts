import { execFileSync } from 'node:child_process';
import path from 'node:path';

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import {
  GenericContainer,
  Wait,
  type StartedTestContainer,
} from 'testcontainers';
import type { TestProject } from 'vitest/node';

import { startRegister, type StartedRegister } from './register.js';
import { startServer, type StartedServer } from './server.js';

// The same images the product runs on. A moving tag would make a failing run a
// different question every time.
const POSTGRES_IMAGE = 'postgres:17-alpine';
const STORAGE_IMAGE = 'rustfs/rustfs:1.0.0-alpha.68';

const STORAGE_ROOT = 'rustfsadmin';
const BUCKET = 'documents';

/*
 * Two databases in the one container, as in production and for the same reason:
 * the register owns its own and it is deliberately not the context's
 * (ADR-0010). A set that put them in one would let a join nobody meant to write
 * pass here and fail on a deployment.
 */
const REGISTRY_DATABASE = 'registry_api_test';

let postgres: StartedPostgreSqlContainer | undefined;
let storage: StartedTestContainer | undefined;
let register: StartedRegister | undefined;
let server: StartedServer | undefined;

/**
 * Named exports rather than a default: vitest reads a default export as the
 * whole globalSetup and drops a sibling `teardown`, which leaks the containers.
 */
export async function setup(project: TestProject): Promise<void> {
  postgres = await new PostgreSqlContainer(POSTGRES_IMAGE)
    .withDatabase('cadastre_api_test')
    .start();

  storage = await new GenericContainer(STORAGE_IMAGE)
    .withExposedPorts(9000)
    .withEnvironment({
      RUSTFS_ROOT_USER: STORAGE_ROOT,
      RUSTFS_ROOT_PASSWORD: STORAGE_ROOT,
      RUSTFS_ADDRESS: ':9000',
      RUSTFS_CONSOLE_ENABLE: 'false',
      RUSTFS_LOG: 'error',
    })
    .withWaitStrategy(Wait.forListeningPorts())
    .start();

  const databaseUrl = postgres.getConnectionUri();

  // `migrate deploy`, not a schema push: whether the history applies cleanly to
  // an empty database is exactly what a push would never tell us.
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: path.join(
      import.meta.dirname,
      '..',
      '..',
      '..',
      '..',
      'packages',
      'verification',
    ),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });

  /*
   * And the register beside it. The archive-search route is a door onto a
   * system outside this one, so the set gives it that system rather than a
   * stand-in for the stand-in: its own database, its own migrations, its own
   * seed, its own process.
   */
  const registryRoot = path.join(
    import.meta.dirname,
    '..',
    '..',
    '..',
    'registry-stub',
  );
  const registryUrl = withDatabase(databaseUrl, REGISTRY_DATABASE);

  // The container's own superuser, not `postgres`: PostgreSqlContainer's
  // default role is `test`, and `createdb` run as a role that does not exist
  // fails with a message about authentication rather than about the role.
  await postgres.exec([
    'createdb',
    '-U',
    postgres.getUsername(),
    REGISTRY_DATABASE,
  ]);

  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: registryRoot,
    env: { ...process.env, DATABASE_URL: registryUrl },
    stdio: 'inherit',
  });
  execFileSync(process.execPath, ['build/infrastructure/persistence/seed.js'], {
    cwd: registryRoot,
    env: { ...process.env, DATABASE_URL: registryUrl },
    stdio: 'inherit',
  });

  register = await startRegister({
    NODE_ENV: 'test',
    SERVICE_PORT: '3311',
    SERVICE_HOST: '127.0.0.1',
    LOG_LEVEL: process.env.LOG_LEVEL ?? 'silent',
    DATABASE_URL: registryUrl,
  });

  server = await startServer({
    NODE_ENV: 'test',
    SERVICE_PORT: '3210',
    SERVICE_HOST: '127.0.0.1',
    DATABASE_URL: databaseUrl,
    WEB_ORIGIN: 'http://localhost:5173',
    S3_ENDPOINT: `http://${storage.getHost()}:${storage.getMappedPort(9000)}`,
    S3_REGION: 'rustfs',
    S3_BUCKET: BUCKET,
    S3_ACCESS_KEY: STORAGE_ROOT,
    S3_SECRET_KEY: STORAGE_ROOT,
    S3_FORCE_PATH_STYLE: 'true',
    S3_PRESIGN_TTL: '600',
    PDF_PAGE_DPI: '96',
    PDF_MAX_PAGES: '10',
    /*
     * Offline everywhere. What this set is for is the transport — routes,
     * status codes, the shape on the wire — and a model-backed stage would make
     * every run depend on somebody else's uptime to answer a question about our
     * own HTTP layer.
     */
    OCR_PROVIDER: 'mock',
    SEGMENTER_PROVIDER: 'mock',
    CLASSIFIER_PROVIDER: 'mock',
    EXTRACTOR_PROVIDER: 'mock',
    CROSS_CHECKER_PROVIDER: 'mock',
    /*
     * The register, though, is real here — and that is not the same switch.
     * `REGISTRY_PROVIDER` is the verification context's own, for running a
     * submission's pipeline with no register process; it stays `mock` so the
     * specs above keep asking about the transport and nothing else.
     * `REGISTRY_URL` is what the archive-search route calls, and it is the
     * process started above.
     */
    REGISTRY_URL: register.baseUrl,
  });

  project.provide('baseUrl', server.baseUrl);
}

export async function teardown(): Promise<void> {
  await server?.stop();
  await register?.stop();
  await storage?.stop();
  await postgres?.stop();
}

/** The same server and credentials, a different database on it. */
function withDatabase(connectionUri: string, database: string): string {
  const url = new URL(connectionUri);
  url.pathname = `/${database}`;

  return url.toString();
}

declare module 'vitest' {
  interface ProvidedContext {
    baseUrl: string;
  }
}
