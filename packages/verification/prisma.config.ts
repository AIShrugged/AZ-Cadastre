import path from "node:path";
import { defineConfig } from "prisma/config";

// A Prisma config file disables Prisma's own .env loading, so load it here —
// .env first, so .env.local wins, as it does in Nest.
for (const file of [".env", ".env.local"]) {
  try {
    process.loadEnvFile(path.join(import.meta.dirname, file));
  } catch {
    // file absent — fall back to the ambient environment
  }
}

const persistence = path.join("src", "infrastructure", "persistence");

export default defineConfig({
  schema: path.join(persistence, "schema"),
  migrations: { path: path.join(persistence, "migrations") },
  // Prisma 7 no longer reads the URL from the schema; Migrate takes it here.
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
