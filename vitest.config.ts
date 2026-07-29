import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const from = (path: string): string =>
  fileURLToPath(new URL(path, import.meta.url));

/**
 * Specs live beside the source they cover — `confidence.vo.ts` →
 * `confidence.vo.spec.ts` — so there is no `test/` root to point at. There is no
 * setup file and no shared fixture module either: a spec builds what it needs
 * itself.
 *
 * Workspace packages resolve to their sources rather than their `build/`
 * output, so running the specs never depends on having built anything first.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@cadastre/kernel": from("./libs/shared/kernel/src/index.ts"),
      "@cadastre/application": from("./libs/shared/application/src/index.ts"),
      "@cadastre/contracts": from("./libs/contracts/src/index.ts"),
      "@cadastre/verification": from("./libs/contexts/verification/src/index.ts"),
    },
  },
  test: {
    include: ["{apps,libs}/**/src/**/*.spec.ts"],
    exclude: ["**/node_modules/**", "**/build/**", "**/generated/**"],
  },
});
