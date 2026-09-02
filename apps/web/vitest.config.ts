import path from 'node:path';

import { defineConfig } from 'vitest/config';

/**
 * The unit set for the client. `node` and not a DOM: what is tested here is the
 * logic a component leans on — what a surface refuses before a service is
 * asked, and what the transport sends — never the rendering, which the browser
 * set will own when there is one (TECH_DEBT §3).
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['**/index.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
