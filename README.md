# AZ-Cadastre

AI-assisted document verification system for the Real Estate Registration Authority.

## Overview

AZ-Cadastre processes multi-page, multi-format document packages (PDF, JPG, PNG) in multiple languages (Azerbaijani Latin/Cyrillic scripts) with complex validation workflows and human intervention loops. The system provides real-time progress updates to inspectors while maintaining comprehensive audit trails.

An uploaded file is a **container**, not a document: one PDF may hold a passport
on sheet 1 and a title deed on sheets 2–4. The inspector attaches files; the
pipeline reads each one into the documents it actually holds, and classifies and
extracts from those. See `packages/verification/CONTEXT.md` for the language
this is expressed in.

## Key Features

- **Multi-Stage Verification Pipeline**: orchestrated workflow (page rendering, OCR, document detection, classification, field extraction, completeness check, cross-validation, report generation, human review)
- **Real-Time Updates**: WebSocket-based progress notifications
- **Long-Running Workflows**: Temporal-based orchestration for resumable, auditable processes
- **Structured Data Integration**: PostgreSQL for application data, RustFS (S3-compatible) for document storage
- **Archive Register Lookup**: the property a submission is for is looked up in the cadastre archive register — is there a record of this address, who does it say holds it, what area does it say, and which folder is the paper in (ADR-0009)

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

Three kinds of project, and only three. Each is a real package, imported by
package name and tagged under `nx.tags` in its `package.json` with what it is.
The tags are the vocabulary the dependency rule in `.oxlintrc.json` is written
in, and they are how a subset is selected: `nx run-many -t build -p
tag:type:context`.

```
apps/                       # deployables: composition roots and UI. No business rules
  server/                   #   type:app — validates env, mounts contexts, binds ports
    src/main.ts             #     bootstrap, transports, global pipes
    src/server.module.ts    #     imports every context module, passes its config slice
    src/config/             #     the one env schema in the system
    src/infrastructure/     #     port → implementation bindings. The extraction seam
  web/                      #   type:app — the inspector's client
  registry-stub/            #   type:app — the stand-in archive register (ADR-0009).
                            #     Not a context: it speaks the contracts, decides
                            #     nothing, and answers from `fixtures/`
packages/                   # bounded contexts: own language, own model, own database
  verification/             #   type:context
    CONTEXT.md              #     its ubiquitous language and what to avoid calling things
    docs/adr/               #     decisions local to this context
    src/domain/             #     aggregates, entities, value objects, events,
                            #     exceptions, repository interfaces — no framework
    src/application/        #     ports/{inbound,outbound}, use cases, services
    src/infrastructure/     #     Prisma schema/migrations/client, adapters
    src/index.ts            #     the port, the module, the options type. Nothing else
libs/                       # everything that is not a context
  api-contracts/            #   type:contracts — the published language. Zod + plain TS
  api-gateway/              #   type:edge — HTTP. Talks to contexts through client ports
  shared/                   #   type:kernel — the bottom of the stack. Imports nothing
  event-publisher/          #   type:adapter — one capability behind a port
  logger/                   #   type:adapter — the Logger port and its pino adapter
  matching-engine/          #   type:engine — pure rules: whether two ways of writing
                            #     an address, name, area or reference mean one thing
docs/
  adr/                      # system-wide Architectural Decision Records
CONTEXT-MAP.md              # the contexts, their relationships, and the word conflicts
```

A context owns its database: its schema, client and migration history all live
under `src/infrastructure/persistence/`, never in a shared package. Two contexts
never import each other — cross-context traffic goes through a port typed by
`@cadastre/api-contracts` and bound in `apps/server/src/infrastructure/`. `pnpm
lint` (oxlint) enforces both, and bans relative imports that escape a package,
because a package-name rule cannot see one.

Tests are per package: each one that has specs owns a `vitest.config.ts`
covering its own `src/`, and `pnpm test` runs them through nx, which builds a
package's dependencies first. Nothing aliases a package name back to its
sources — a spec imports `@cadastre/shared` exactly as production code does.

See [ADR-0006](docs/adr/0006-contexts-contracts-edge-and-composition-root.md)
for why the backend is shaped this way, [CONTEXT-MAP.md](CONTEXT-MAP.md) for
what the boundaries are, and `.claude/skills/backend/` for the conventions in
full.

## Getting Started

This is a monorepo project using pnpm workspaces.

```bash
pnpm install                                      # install and generate the Prisma client
cp apps/server/.env.example apps/server/.env      # the running service's environment
cp packages/verification/.env.example \
   packages/verification/.env                     # DATABASE_URL for migrations

pnpm --filter @cadastre/verification db:migrate   # apply the context's migrations
pnpm build                                        # build every package, in dependency order
pnpm lint                                         # check the dependency rule holds
pnpm --filter @cadastre/server dev                # run the API
```

Unit tests live beside the source they cover (`confidence.vo.ts` →
`confidence.vo.spec.ts`). `pnpm test` runs every package's; `pnpm --filter
@cadastre/verification test:watch` runs one package's in watch mode, and
`test:coverage` reports on it.

## Docker

Build and run the application in Docker:

```bash
# Build frontend from repository root
docker build -f apps/web/Dockerfile -t frontend-app .

# Build backend from repository root
docker build -f apps/server/Dockerfile -t server-app .

# Build the stand-in archive register
docker build -f apps/registry-stub/Dockerfile -t registry-app .

# Run with docker-compose (includes frontend, backend, and database)
docker compose up --build
```

### Migrations in a container

The verification context owns its database, so its migration history travels
inside its own package — not in `apps/server`, where there is no Prisma at all
(`npx prisma` from there answers `prisma: not found`). Run them from the package:

```bash
docker compose exec -w /app/packages/verification backend pnpm db:deploy
```

`db:deploy` is `prisma migrate deploy`: it applies what is pending, never
prompts and never resets. `pnpm exec prisma migrate status` reports without
applying anything.

To stop doing it by hand, let the service migrate before it serves — give the
`backend` service its own command in `docker-compose.yml`:

```yaml
command: >
  sh -c "cd /app/packages/verification && pnpm db:deploy &&
         cd /app/apps/server && node build/main.js"
```

`migrate deploy` is idempotent, so a restart re-runs it harmlessly and a
deployment that adds a column needs no separate step. It suits a single
instance: several replicas booting together would each try to migrate at once,
and that is when the migration belongs in a job of its own instead.

See [docs/DOCKER.md](docs/DOCKER.md) for detailed Docker setup and deployment instructions.
