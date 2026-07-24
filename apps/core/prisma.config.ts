import path from "node:path";
import { defineConfig } from "prisma/config";

// A Prisma config file disables Prisma's automatic .env loading, so we load it
// ourselves. Mirror Nest's precedence (.env.local overrides .env) by loading
// .env first and letting .env.local win. Both files are optional.
for (const file of [".env", ".env.local"]) {
  try {
    process.loadEnvFile(path.join(import.meta.dirname, file));
  } catch {
    // file absent — fall back to the ambient environment
  }
}

export default defineConfig({
  // Multi-file schema: every *.prisma under prisma/schema/ is loaded. Keep one
  // model (or closely-related enum) per file so the schema never grows into a
  // single big ball of mud.
  schema: path.join("prisma", "schema"),
  migrations: { path: path.join("prisma", "migrations") },
  // Prisma 7 no longer reads the connection URL from the schema — Migrate and
  // introspection get it from here (the runtime client gets it via the pg
  // driver adapter in PrismaService).
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
