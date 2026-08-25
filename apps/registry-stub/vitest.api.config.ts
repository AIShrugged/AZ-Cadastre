import { defineConfig } from 'vitest/config';

/**
 * The API set for the register: the built process, over HTTP.
 *
 * It needs no container — the register holds a file, not a database — but it
 * does need the real process: what it guards is the route, the global pipe that
 * rejects a body the published schema does not accept, and the shape on the
 * wire.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.e2e.spec.ts'],
    globalSetup: ['./test/harness/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
