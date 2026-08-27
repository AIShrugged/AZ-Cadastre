import path from 'node:path';

import { defineConfig } from 'prisma/config';

// A Prisma config file disables Prisma's own .env loading, so load it here.
// `.env.local` first, because `loadEnvFile` never overwrites a variable that is
// already set — the first file to name one wins, and the ambient environment
// wins over both. Loading `.env` first, as this did until 2026-08-27, made
// `.env.local` the file that never won.
for (const file of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(path.join(import.meta.dirname, file));
  } catch {
    // file absent — fall back to the ambient environment
  }
}

const persistence = path.join('src', 'infrastructure', 'persistence');

export default defineConfig({
  schema: path.join(persistence, 'schema'),
  migrations: { path: path.join(persistence, 'migrations') },
  // Prisma 7 no longer reads the URL from the schema; Migrate takes it here.
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
