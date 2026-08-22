import { defineConfig } from 'vitest/config';

/**
 * A second configuration rather than a tag: this set needs a container, a
 * migration run and minute-scale timeouts, and mixing that into the unit set
 * would make every run pay for docker.
 */
export default defineConfig({
  test: {
    environment: 'node',
    // See test/setup.ts — it must load before any decorated class.
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/__tests__/*.int.spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    // One database, so the specs cannot run against each other.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 180_000,
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      reportsDirectory: './coverage-integration',
      // What only a real database can answer for. The domain's own ratio is
      // measured by the unit set and the two are not added up.
      include: ['src/infrastructure/persistence/**/*.ts'],
      exclude: ['src/infrastructure/persistence/generated/**'],
    },
  },
});
