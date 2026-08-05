# AZ-Cadastre

AI-assisted document verification system for the Real Estate Registration Authority.

## Overview

AZ-Cadastre processes multi-page, multi-format document packages (PDF, JPG, PNG) in multiple languages (Azerbaijani Latin/Cyrillic scripts) with complex validation workflows and human intervention loops. The system provides real-time progress updates to inspectors while maintaining comprehensive audit trails.

An uploaded file is a **container**, not a document: one PDF may hold a passport
on sheet 1 and a title deed on sheets 2–4. The inspector attaches files; the
pipeline reads each one into the documents it actually holds, and classifies and
extracts from those. See `docs/CONTEXT.md` for the language this is expressed in.

## Key Features

- **Multi-Stage Verification Pipeline**: orchestrated workflow (page rendering, OCR, document detection, classification, field extraction, completeness check, cross-validation, report generation, human review)
- **Real-Time Updates**: WebSocket-based progress notifications
- **Long-Running Workflows**: Temporal-based orchestration for resumable, auditable processes
- **Structured Data Integration**: PostgreSQL for application data, RustFS (S3-compatible) for document storage

## Models and confidence

Every reading the pipeline reports — a transcribed sheet, a document's type, an
extracted field — carries a confidence, and PRD §4.6 makes that number decide
something: below `0.80` the reading goes to the inspector as a finding instead
of into the register as a fact.

So the number has to be real. It is taken as the **lower** of two independent
accounts: the token logprobs the route returns, and the model's own stated
certainty (or, for transcription, the share of the page it did not mark
`<?doubtful>`). Where a route offers neither, the reading is recorded as
**unscored** rather than given a flattering default, which puts it below the
floor and in front of a human.

That matters more than it sounds. OpenRouter serves one model id from several
providers, and they do not all honour `logprobs: true` — some return a
one-token stub for a whole page, some return a table of perfect zeroes. The
defaults in `.env.example` and `docker-compose.yml` are models observed to
return real, varying logprobs from **every** provider that serves them.

**Read [docs/MODELS.md](docs/MODELS.md) before changing `OCR_MODEL`,
`SEGMENTER_MODEL`, `CLASSIFIER_MODEL`, `EXTRACTOR_MODEL` or
`CROSS_CHECKER_MODEL`.** It records what
each candidate actually answered, gives a one-command check for a new one, and
explains why `PDF_PAGE_DPI` is 300 rather than 150.

## Project Structure

```
apps/
  web/                      # Client-facing UI application
  core/                     # Composition root: mounts contexts, serves HTTP
libs/
  contexts/
    verification/           # The verification bounded context
      src/domain/           #   aggregates, entities, value objects, events,
                            #   exceptions, repository interfaces — no framework
      src/application/      #   use cases (command + handler), ports, read models
      src/infrastructure/   #   Prisma schema/migrations/client, adapters
      src/api/http/         #   controllers, exception filter
  shared/                   # backend-only
    kernel/                 #   What a domain model extends. No dependencies at all
    application/            #   Use-case machinery shared by every context
  contracts/                # Zod schemas, one file per endpoint — the wire, not
                            # the backend, which is why it sits outside shared/
docs/
  adr/                      # Architectural Decision Records
```

A context owns its database: its schema, client and migration history all live
under `src/infrastructure/persistence/`, never in a shared package. See
[ADR-0005](docs/adr/0005-bounded-context-packages.md) for why the backend is
shaped this way, and `.claude/skills/backend/` for the conventions in full.

## Getting Started

This is a monorepo project using pnpm workspaces.

```bash
pnpm install                                      # install and generate the Prisma client
cp apps/core/.env.example apps/core/.env          # the running service's environment
cp libs/contexts/verification/.env.example \
   libs/contexts/verification/.env                # DATABASE_URL for migrations

pnpm --filter @cadastre/verification db:migrate   # apply the context's migrations
pnpm build                                        # build every package, in dependency order
pnpm --filter @cadastre/core dev                  # run the API
```

Unit tests live beside the source they cover (`confidence.vo.ts` →
`confidence.vo.spec.ts`) and run with `pnpm test`.

## Docker

Build and run the application in Docker:

```bash
# Build frontend from repository root
docker build -f apps/web/Dockerfile -t frontend-app .

# Build backend from repository root
docker build -f apps/core/Dockerfile -t core-app .

# Run with docker-compose (includes frontend, backend, and database)
docker compose up --build
```

### Migrations in a container

The verification context owns its database, so its migration history travels
inside its own package — not in `apps/core`, where there is no Prisma at all
(`npx prisma` from there answers `prisma: not found`). Run them from the package:

```bash
docker compose exec -w /app/libs/contexts/verification backend pnpm db:deploy
```

`db:deploy` is `prisma migrate deploy`: it applies what is pending, never
prompts and never resets. `pnpm exec prisma migrate status` reports without
applying anything.

To stop doing it by hand, let the service migrate before it serves — give the
`backend` service its own command in `docker-compose.yml`:

```yaml
    command: >
      sh -c "cd /app/libs/contexts/verification && pnpm db:deploy &&
             cd /app/apps/core && node build/main.js"
```

`migrate deploy` is idempotent, so a restart re-runs it harmlessly and a
deployment that adds a column needs no separate step. It suits a single
instance: several replicas booting together would each try to migrate at once,
and that is when the migration belongs in a job of its own instead.

See [docs/DOCKER.md](docs/DOCKER.md) for detailed Docker setup and deployment instructions.
