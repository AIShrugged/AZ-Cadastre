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
- **Accounts and two roles**: an **operator** is the office and does everything the API does; a **user** is the applicant, who files a package, sees only their own submissions and sends in a document one of them is short of. Sign-in is a session cookie and every route but the four `/api/auth` ones needs one (ADR-0029)

## Models and confidence

Every reading the pipeline reports — a transcribed sheet, a document's type, an
extracted field — carries a confidence, and PRD §4.6 makes that number decide
something: below `Confidence.FLOOR` the reading goes to the inspector as a
finding instead of into the register as a fact — and the document it was read
off is offered to be sent in again (ADR-0024).

The floor is `0.85`, raised from the PRD's `0.80` when targeted supply arrived:
one number decides both what the report doubts and what the package offers to
be sent again, and a second one beside it would be two "low confidences" in one
product. Clients read it from the contract as `CONFIDENCE_FLOOR` rather than
keeping a copy.

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
                            #     nothing, and answers from its own database —
                            #     own schema, own migrations, own seed (ADR-0010)
packages/                   # bounded contexts: own language, own model, own database
  accounts/                 #   type:context — who may use the system, the credential
                            #     they sign in with and the role they do it in. Its own
                            #     database, and no word for a session: that is the
                            #     edge's (ADR-0029)
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

## Documentation

- [Как работает программа — полный цикл](docs/process-overview.md) — полный цикл обработки
  пакета документов: от загрузки до отчёта инспектору.
- [Architecture diagrams](docs/architecture/) — the C4 views and the ERD of both
  databases, as a [LikeC4](https://likec4.dev) model. The `.c4` files are the
  source; the PNGs are generated. `npx -y likec4@1 start docs/architecture` opens
  them in a browser.

What runs, in one picture — the system context, the components of
`cadastre-core`, the verification run as a sequence and an ERD per database are
all in [docs/architecture](docs/architecture/):

[![Containers](docs/architecture/exports/containers.png)](docs/architecture/)

## Getting Started

This is a monorepo project using pnpm workspaces.

```bash
pnpm install                                      # install and generate the Prisma client
cp apps/server/.env.example apps/server/.env      # the running service's environment
cp packages/verification/.env.example \
   packages/verification/.env                     # DATABASE_URL for migrations
cp packages/accounts/.env.example \
   packages/accounts/.env                         # and for the accounts context's own

docker compose up -d postgres rustfs              # the accounts and register databases
                                                  #   are made by the init script, on a
                                                  #   new data directory only
pnpm --filter @cadastre/verification db:migrate   # apply the context's migrations
pnpm --filter @cadastre/accounts db:migrate       # and the accounts context's
pnpm build                                        # build every package, in dependency order
pnpm lint                                         # check the dependency rule holds
pnpm --filter @cadastre/server dev                # run the API
```

On a Postgres volume that already exists, the init script does not run — the
official image runs it only when it creates the data directory — so make the two
extra databases by hand:

```bash
docker exec cadastre-postgres createdb -U postgres cadastre-accounts
docker exec cadastre-postgres createdb -U postgres cadastre-registry
```

### Signing in

Every route under `/api` needs a session except `POST /api/auth/register`,
`POST /api/auth/login`, `POST /api/auth/logout` and `GET /api/auth/me`. Two
accounts are put in at start-up so a stack brought up from nothing can be opened
— with the passwords `apps/server/.env.example` carries:

| Account                | Role       | Local password   | What it may do                                                                                        |
| ---------------------- | ---------- | ---------------- | ----------------------------------------------------------------------------------------------------- |
| `operator@cadastre.az` | `operator` | `operator-local` | Everything: intake, the whole register of cases, the overview, the archive search and its approval    |
| `user@cadastre.az`     | `user`     | `user-local-pw`  | Files a package, sees **only their own** submissions, and supplies a document one of them is short of |

The addresses are fixed in the code; only the passwords come from the
environment (`SEED_OPERATOR_PASSWORD`, `SEED_USER_PASSWORD`), and they have no
default — leave one out and that account is not seeded, and the start-up log
says so by name. The seed is idempotent by **leaving an existing account alone**:
changing a password in `.env` after the first run does nothing, because the
environment is not the authority over a credential somebody may have changed.
An applicant opens their own account at `POST /api/auth/register`; an operator
is never self-registered.

Set `SESSION_SECRET` too. Without it the server invents one per process — fine
on a laptop, wrong anywhere shared, because a restart then signs everybody out
and a second replica accepts nothing the first one issued. The start-up line
says which of the two is happening. The whole of the decision, including what it
deliberately does not do: [ADR-0029](docs/adr/0029-accounts-are-a-context-of-their-own-and-a-session-is-the-edges.md)
and `TECH_DEBT.md` §16.

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

Neither service image can migrate its own database, and this is on purpose.
`prisma` is a devDependency of `packages/verification`, `packages/accounts` and
`apps/registry-stub`, and every runtime stage installs with `--prod`, so the CLI
is not in them — `docker exec cadastre-registry pnpm db:deploy` answers `sh:
prisma: not found`, and in `cadastre-core` it does not even reach Prisma. Adding
the CLI to a service image would put `migrate reset` and a bundled Prisma Studio
inside a container that is exposed to the internet, for a command that runs once
per deploy.

So migrating is its own image, `ekalkutin/cadastre-migrator`, holding the Prisma
CLI, every schema and every migration history and nothing that serves traffic.
It is a compose profile rather than a service, so it never starts with `up`:

```bash
docker compose run --rm migrate            # every database
docker compose run --rm migrate core       # cadastre-db only
docker compose run --rm migrate accounts   # cadastre-accounts only
docker compose run --rm migrate registry   # cadastre-registry only
docker compose run --rm migrate status     # report what is pending, apply nothing
```

Everything it needs — the CLI and Prisma's schema engine — is baked in at build
time, so applying a migration on the stand needs no package registry. It is
`prisma migrate deploy` underneath: it applies what is pending, never prompts
and never resets, so re-running it is harmless.

Run it **before** starting the services, not from them. Migrating on start-up
looks tidier and costs two things: two containers booting together race for the
same database, and a stand rolled back by pulling the previous tag migrates
itself forward on the way there.

Why an image rather than the CLI in the service images, and what else was
weighed: [ADR-0020](docs/adr/0020-migrations-are-applied-by-an-image-of-their-own.md).

See [docs/DOCKER.md](docs/DOCKER.md) for detailed Docker setup and deployment instructions.
