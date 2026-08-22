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

import { startServer, type StartedServer } from './server.js';

// The same images the product runs on. A moving tag would make a failing run a
// different question every time.
const POSTGRES_IMAGE = 'postgres:17-alpine';
const STORAGE_IMAGE = 'rustfs/rustfs:1.0.0-alpha.68';

const STORAGE_ROOT = 'rustfsadmin';
const BUCKET = 'documents';

let postgres: StartedPostgreSqlContainer | undefined;
let storage: StartedTestContainer | undefined;
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
  });

  project.provide('baseUrl', server.baseUrl);
}

export async function teardown(): Promise<void> {
  await server?.stop();
  await storage?.stop();
  await postgres?.stop();
}

declare module 'vitest' {
  interface ProvidedContext {
    baseUrl: string;
  }
}
