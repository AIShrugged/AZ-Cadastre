The architecture diagrams are **source, not pictures**. The `.c4` files in this
folder are the model; the PNGs in `exports/` are generated from them and are
never edited by hand. Change the model, re-export, commit both.

Written with [LikeC4](https://likec4.dev) — a DSL that keeps one model and
projects several views out of it, so the container diagram and the ERD cannot
drift apart the way two hand-drawn pictures do.

## The views

| View                   | What it answers                                                     | PNG                                                                        |
| ---------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `index`                | System context — who uses this and what it depends on               | [index.png](exports/index.png)                                             |
| `containers`           | What runs: web, `cadastre-core`, two databases, storage, the register | [containers.png](exports/containers.png)                                   |
| `backend`              | Components of `cadastre-core` — the ports-and-adapters seam         | [backend.png](exports/backend.png)                                         |
| `verificationProcess`  | The verification run, upload to report, as a sequence               | [verificationProcess.png](exports/verificationProcess.png)                  |
| `erdCadastreDb`        | ERD of `cadastre-db` (the verification context)                     | [erdCadastreDb.png](exports/erdCadastreDb.png)                             |
| `erdCadastreRegistry`  | ERD of `cadastre-registry` (the archive register)                   | [erdCadastreRegistry.png](exports/erdCadastreRegistry.png)                  |
| `erdBothDatabases`     | Both schemas side by side, with no edge between them (ADR-0010)     | [erdBothDatabases.png](exports/erdBothDatabases.png)                       |

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
