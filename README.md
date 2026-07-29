# AZ-Cadastre

AI-assisted document verification system for the Real Estate Registration Authority.

## Overview

AZ-Cadastre processes multi-page, multi-format document packages (PDF, JPG, PNG) in multiple languages (Azerbaijani Latin/Cyrillic scripts) with complex validation workflows and human intervention loops. The system provides real-time progress updates to inspectors while maintaining comprehensive audit trails.

## Key Features

- **Multi-Stage Verification Pipeline**: 7-stage orchestrated workflow (classification, OCR, completeness check, cross-validation, legal rules, report generation, human review)
- **Real-Time Updates**: WebSocket-based progress notifications
- **Long-Running Workflows**: Temporal-based orchestration for resumable, auditable processes
- **Structured Data Integration**: PostgreSQL for application data, RustFS (S3-compatible) for document storage

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

See [docs/DOCKER.md](docs/DOCKER.md) for detailed Docker setup and deployment instructions.
