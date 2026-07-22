# AZ-Cadastre — working notes for Claude

## Read first

- `CONTEXT.md` — glossary (ubiquitous language). Use these terms exactly.
- `docs/PRD.md` — the MVP spec. Temporal is the *target* architecture; MVP runs in-process (ADR-0001).
- `docs/adr/` — decisions 0001–0004. Do not violate them silently; propose a new ADR instead.

## Architecture (ADR-0004)

- `libs/contracts` — **zod DTO schemas only** (API contract web↔core). No domain types here.
- `apps/core` — NestJS, 4 layers: api / application / domain / infrastructure. Verification Profiles and the validation engine live in `domain`. Ports (`ObjectStorage`, `OcrProvider`, `DocumentClassifier`, `FieldExtractor`) are abstract classes declared in `application`, implemented in `infrastructure`; MVP uses mocks — the user writes real adapters themselves.
- `apps/web` — Vite/React/shadcn, polls the REST API.
- Build order: contracts → core → web (`pnpm --filter @cadastre/contracts build` first).

## Status (as of 2026-07-22)

Design session complete; **no application code written yet**. Next step, agreed with the user: write `docs/api.md` — REST endpoints (`POST /api/packages`, `GET /api/packages`, `GET /api/packages/:id`, `GET /api/packages/:id/report`), DTO shapes, package statuses (`Created → Processing → Completed/Failed`) — for user review **before** any code. After approval: zod schemas in `libs/contracts`, then `apps/core` domain layer.

Undecided (proposals on the table, user hasn't confirmed): ORM (Prisma proposed), PDF→PNG rendering (poppler/`pdftoppm` proposed).
