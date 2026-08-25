import type { TestProject } from 'vitest/node';

import { startRegister, type StartedRegister } from './register.js';

let register: StartedRegister | undefined;

/**
 * Named exports rather than a default: vitest reads a default export as the
 * whole globalSetup and drops a sibling `teardown`, which would leak the
 * process.
 */
export async function setup(project: TestProject): Promise<void> {
  register = await startRegister({
    NODE_ENV: 'test',
    SERVICE_PORT: '3310',
    SERVICE_HOST: '127.0.0.1',
    LOG_LEVEL: process.env.LOG_LEVEL ?? 'silent',
    // The shipped records: what a caller testing against this service gets.
    REGISTRY_FIXTURES: 'fixtures',
  });

  project.provide('baseUrl', register.baseUrl);
}

export async function teardown(): Promise<void> {
  await register?.stop();
}

declare module 'vitest' {
  interface ProvidedContext {
    baseUrl: string;
  }
}
