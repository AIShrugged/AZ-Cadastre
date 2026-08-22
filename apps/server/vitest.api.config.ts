import { defineConfig } from 'vitest/config';

/**
 * The API set: the built process, real containers, and HTTP.
 *
 * It measures no coverage. What it guards — routing, the global pipe, the
 * status a domain code maps to, the shape on the wire — is not a ratio of
 * lines, and mixing it into the domain's ratio would only make that number
 * lie.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.e2e.spec.ts'],
    globalSetup: ['./test/harness/global-setup.ts'],
    // One server and one database, so the specs cannot run against each other.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 240_000,
  },
});
