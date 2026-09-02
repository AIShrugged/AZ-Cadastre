The architecture diagrams are **source, not pictures**. The `.c4` files in this
folder are the model; the PNGs in `exports/` are generated from them and are
never edited by hand. Change the model, re-export, commit both.

Written with [LikeC4](https://likec4.dev) — a DSL that keeps one model and
projects several views out of it, so the container diagram and the ERD cannot
drift apart the way two hand-drawn pictures do.

The pictures below are the exported PNGs. They are wide — click one to open it
full size, or run `npx -y likec4@1 start docs/architecture` and pan around the
live model instead.

## System context — who uses this, and what it depends on

The archive register is drawn **outside** the system on purpose:
`apps/registry-stub` is run by us today, but it stands in for a system that is
not ours and is deleted rather than migrated when a real one answers the same
contract (ADR-0009).

[![System context](exports/index.png)](exports/index.png)

## Containers — what actually runs

`apps/web` → `libs/api-gateway` → `packages/verification` → `apps/registry-stub`,
the sketch in `CONTEXT-MAP.md` made literal. The gateway and the verification
context are one process, `cadastre-core`; the seam between them is
`@cadastre/api-contracts`, and it is the only thing that has to change if
verification ever becomes its own service.

Two databases, not one, and no edge between them.

[![Containers](exports/containers.png)](exports/containers.png)

## Components of `cadastre-core` — the ports-and-adapters seam

The pipeline names a port; `apps/server/src/infrastructure/index.ts` binds it to
one of these adapters. Every provider has a `mock` implementation of the same
port, which is why the whole pipeline runs offline.

[![Components of cadastre-core](exports/backend.png)](exports/backend.png)

## The verification run, upload to report

`RunVerificationHandler.execute`, stage by stage. Two rules govern the whole
sequence: **no stage may stop the run** — a file that will not split, a sheet
the reader refuses, an archive that does not answer, each becomes a line in the
report and the run goes on — and **nothing below 0.80 confidence is a fact**, it
is a question for the inspector.

[![The verification process](exports/verificationProcess.png)](exports/verificationProcess.png)

## ERD — `cadastre-db`, the verification context

Thirteen tables. An edge runs from the table holding the foreign key to the one
it references, labelled with the column and what happens to the row when the
referenced one goes. Verification Profiles are not here: they live in code
(ADR-0002).

[![ERD — cadastre-db](exports/erdCadastreDb.png)](exports/erdCadastreDb.png)

## ERD — `cadastre-registry`, the archive register

Six tables, everything hanging off one object keyed
`(territorialOffice, registerNo)` — not off the address, which is never unique
and never was.

[![ERD — cadastre-registry](exports/erdCadastreRegistry.png)](exports/erdCadastreRegistry.png)

## ERD — both databases

Both schemas in one picture and deliberately **without a single edge between
them**. A join between a submission and the record of a registration is the one
thing that must stay impossible; two databases make it a network call, which is
what it actually is (ADR-0010). If an edge ever appears across this gap, the
model is wrong or the code is.

[![ERD — both databases](exports/erdBothDatabases.png)](exports/erdBothDatabases.png)

## The files

| File                        | What is in it                                                                |
| --------------------------- | ---------------------------------------------------------------------------- |
| `specification.c4`          | The vocabulary: element kinds, tags, relationship kinds and their styling     |
| `system.c4`                 | The C4 model — people, systems, containers, components, and what talks to what |
| `erd-cadastre-db.c4`        | The tables of `cadastre-db`, nested inside its container                      |
| `erd-cadastre-registry.c4`  | The tables of `cadastre-registry`, nested inside its container                |
| `views.c4`                  | The seven views above                                                         |

The ERDs hang off the same elements the C4 views use: `cadastre.cadastreDb` is a
container in `containers` and the parent of thirteen tables in `erdCadastreDb`.
That is the reason for one model rather than two — the databases in the C4
picture and the databases in the ERD are the same two objects, and the fact that
nothing joins them is a property of the model, not of how carefully somebody
drew it.

Each table reads: title is the table name, the small line under it is the keys,
the body is the columns (`?` marks nullable), and the details pane holds the
prose. `id`, `createdAt` and `updatedAt` are left out of the column lists —
every table has them. A node body clips at five lines, which is why
`registry_objects` counts its ten area and ownership columns instead of naming
them; its `description` spells all twenty-two out.

## Running it

No dependency was added to the repo for this — LikeC4 is a one-off tool, run
through `npx` from the repository root:

```bash
# Interactive browser: click into a view, follow the links, read the prose.
# This is the one to use while editing — it hot-reloads on save.
npx -y likec4@1 start docs/architecture

# Syntax, references, and whether every view still lays out.
npx -y likec4@1 validate docs/architecture

# Re-export the PNGs. Two commands: the model declares the process view as a
# sequence diagram and `start` honours that, but `export png` wants the flag.
npx -y likec4@1 export png docs/architecture -o docs/architecture/exports --flat
npx -y likec4@1 export png docs/architecture -o docs/architecture/exports --flat \
  --seq -f verificationProcess
```

`export png` drives a headless Chromium through Playwright. On a machine that
has never run Playwright, the first export asks for it:
`npx -y playwright@1.60 install chromium` — match the version to the
`playwright-core` LikeC4 pulls in, or the browser it downloads is not the
revision it looks for. On a distribution Playwright 1.60 has no build for
(Ubuntu 26.04, for one) that install refuses; point
`PLAYWRIGHT_BROWSERS_PATH` at a Chromium another Playwright already fetched
instead. Everything else — `start`, `validate`, the language server — needs no
browser.

LikeC4 exports PNGs with a transparent background — they take the colour of
whatever page they are read on, which is why they look right in both GitHub
themes and wrong in an image viewer that paints alpha black.

## Editing

- The model is the whole tree, not one file per diagram: an element declared in
  `system.c4` is extended with its tables in `erd-cadastre-db.c4`. Names are
  resolved across all files in the folder.
- Keep the model honest about **this** code. Component titles are package paths
  and class names (`libs/api-gateway`, `RunVerificationHandler`) so that a
  diagram which has drifted can be told from one that has not, by grep.
- When a schema changes, the ERD changes with it in the same commit. The Prisma
  files are the source of truth: `packages/verification/src/infrastructure/persistence/schema/`
  and `apps/registry-stub/src/infrastructure/persistence/schema/`.
- `npx -y likec4@1 format docs/architecture` formats the `.c4` files; the
  repository's prettier does not cover them.
- There is a VS Code extension (`likec4.likec4-vscode`) which gives the same
  preview and diagnostics inside the editor.

## Why here, and no ADR

`docs/architecture/` beside `docs/adr/`, because these are the same kind of
artefact: a statement about the shape of the system that outlives the code that
prompted it. No ADR was written for this — where diagrams live is a convention,
not a decision anyone would argue about, and the decisions the diagrams *show*
already have their ADRs (0006, 0009, 0010) and are cited from the views that
show them.
