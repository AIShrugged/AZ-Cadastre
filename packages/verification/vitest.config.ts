import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      // The generated Prisma client and the migration history are not this
      // context's code; the module wiring is covered by booting the app, not by
      // a unit test.
      include: ["src/**/*.ts"],
      exclude: [
        "**/index.ts",
        "src/infrastructure/persistence/generated/**",
        "src/verification.module.ts",
      ],
    },
  },
});
