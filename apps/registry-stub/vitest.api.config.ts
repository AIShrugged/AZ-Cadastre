import { defineConfig } from 'vitest/config';

/**
 * The API set for the register: the built process, over HTTP, against a real
 * PostgreSQL in a container.
 *
 * It needs the container as of the day the records stopped being a JSON file
 * (ADR-0010), and that is most of what it is for: what it guards is the
 * migration history applying to an empty database, the seed still fitting the
 * schema it writes into, the route, the global pipe that rejects a body the
 * published schema does not accept, and the shape on the wire.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.e2e.spec.ts'],
    globalSetup: ['./test/harness/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    // Pulling the image and applying the migrations on a cold machine is the
    // slow part, and it happens once for the whole set.
    hookTimeout: 180_000,
  },
});
