# Working in this repository

Not a README. The README says how to run the thing; this says how to work in it
and where not to step. Read it before the first change, not after the first
failure.

## What this is

A modular monolith that verifies cadastre submissions. An inspector uploads the
files that came with an application; the system reads them into the logical
documents they hold, extracts the fields a Verification Profile asks for, checks
those fields against each other across documents, and reports what it found and
how sure it is. The inspector decides; the system never does.

One bounded context — `packages/verification` — because the system does one
thing and a second context would today be a folder of related features rather
than a second language. It owns its database, its migrations and its Nest
module. What it promises the rest of the world is in `libs/api-contracts`; the
HTTP edge that calls it is `libs/api-gateway`; the only place that knows both
exist is `apps/server`. Why the tree is shaped this way: ADR-0006. What each
project is and is deliberately not: `CONTEXT-MAP.md`. The context's own
vocabulary: `packages/verification/CONTEXT.md`.

The rules the layout answers to are in `RULE.md`. Where the code departs from
them on purpose, there is an ADR or an entry in `TECH_DEBT.md` — never silence.

## Local development

```bash
pnpm install                 # postinstall runs `prisma generate`
docker compose up -d postgres rustfs
pnpm --filter @cadastre/verification db:migrate
pnpm dev                     # watches every package and starts the server
```

`pnpm dev` is `tsc --watch` per package plus `node --watch build/main.js`, wired
by nx (`dev` depends on `watch`, `watch` depends on `build` and `^watch`). There
is no Nest CLI: it cannot load TypeScript 7 — see the rakes below.

| Service  | Where                 | Credentials                                 |
| -------- | --------------------- | ------------------------------------------- |
| API      | http://localhost:3000 | —                                           |
| Web      | http://localhost:5173 | —                                           |
| Postgres | localhost:5432        | `postgres/postgres`                         |
| RustFS   | localhost:9000        | `rustfsadmin/rustfsadmin` (console on 9001) |

Every provider defaults to `mock`, so the whole pipeline runs with no API key
and no network: the offline adapters run the same domain rules in
`domain/services/` that the model-backed ones are checked against. Point one
stage at OpenRouter at a time — `OCR_PROVIDER=openrouter` — rather than all of
them, which is how a stage gets compared with its stand-in.

Secrets live in `packages/verification/.env.local` and `apps/server/.env.local`,
neither of which is in git.

### Seeing what happened

Everything the service has to say is one structured line per event on the
console — the run of a package stage by stage, every request with its status
and duration, every model call with its model, its upstream provider, its
tokens and what it answered (ADR-0008). `LOG_LEVEL` decides who the reader is:

| Level   | What it adds                                                                                                              |
| ------- | ------------------------------------------------------------------------------------------------------------------------- |
| `info`  | the run: a package started, a file split, a document classified, a check answered, a request served                       |
| `debug` | each stage as it starts, every object read or written, every SQL statement with its duration, every request as it arrives |
| `trace` | SQL parameters — the data itself, so a local database and nothing else                                                    |

`LOG_PRETTY=false` gives one JSON object per line instead, which is what the
container runs. A spec that builds its subject by hand passes `new
SilentLogger()`; the integration harness is silent unless `LOG_LEVEL` is set,
which is the fastest way to see what a failing integration spec actually did.

Log a constant message and put what varies in the context object — `('Sheet
transcribed', { characters, confidence })`, never a sentence with the values
baked into it. And never log a value read off somebody's papers: a field is
logged as its key, whether it was read and how confident the reading was.

## Rakes already stepped on

Each of these cost real time. The symptom is what you will see; the cause is why.

**A Nest dependency is `undefined` at call time, and the container said nothing.**
_2026-08-22._ Nest resolves constructor parameters from `design:paramtypes`,
which the compiler only emits under `emitDecoratorMetadata` — and a test runner
that transforms TypeScript itself may not honour it. vitest 3 transformed with
esbuild, which has never implemented it: every parameter without an explicit
`@Inject` resolved to `undefined`, the module still built, and the failure
surfaced much later as a handler calling a method on nothing.

vitest 4 transforms with rolldown, whose oxc transform does emit it, so the trap
is closed for now — but the defence that does not depend on the toolchain is the
decorator: every parameter typed by an abstract port carries `@Inject(Port)`.
application.md calls it mandatory. Write it on new ports too. If you ever change
the test transform, the check is one spec asserting
`Reflect.getMetadata('design:paramtypes', SomeHandler)` is defined.

**`Nest can't resolve dependencies of X (?)` — and the missing argument is a
Nest class that plainly exists.** _2026-08-22._ Two copies of a @nestjs package
in the store. pnpm keys a package directory by its resolved peer set, so one
workspace package can end up on a different physical copy of @nestjs/cqrs than
its neighbour — same version, same class name, different class identity — and
Nest cannot match a token against a class from the other copy. The error names
the class, which is what makes it confusing: the metadata is fine, the identity
is not.

Diagnose it in one line:

```bash
readlink -f {packages,libs,apps}/*/node_modules/@nestjs/cqrs | sort -u
```

More than one answer is the bug. `pnpm dedupe` collapses them and writes the
result to the lockfile, where it survives a clean install. Check it after any
dependency change that touches a package depending on Nest.

**`pnpm typecheck` fails on a fresh clone with "Cannot find module
@cadastre/shared".** _2026-08-22._ Typecheck is not a standalone check here:
applications import the `build/` of a package, not its source (ADR-0006), so
checking types needs the `.d.ts` of everything below. It is an nx target with
`dependsOn: ["^build"]` for exactly this reason — run `pnpm typecheck`, not
`pnpm -r typecheck`, and nx builds what it needs first.

**`nest` anything fails with `tsBinary.getParsedCommandLineOfConfigFile is not a
function`.** _2026-08-22._ @nestjs/cli builds by calling into the TypeScript
compiler API, and TypeScript 7 — the native port — does not expose the part it
reaches for. The CLI is gone and so is `nest-cli.json`; dev is `tsc --watch`
plus `node --watch`, which is what x-lance-backend does and what nx's `watch`/
`dev` targets were already shaped for. Do not reintroduce @nestjs/cli to get a
schematic: it will take the dev loop down with it.

**A gateway change does not take effect.** Applications import the `build/` of a
package, not its source (ADR-0006). Until `tsc --watch` has run — that is what
`pnpm dev` starts — an edit in `libs/` is invisible. If something makes no sense,
check that the watcher is alive before reading the code again.

**A relative import reaches into another project and the linter is quiet.** The
boundary rules match on package names, so they cannot see
`../../../libs/shared`. A separate rule bans paths with a literal `..` segment
before a workspace root. It is deliberately narrow: `use-cases/packages/` is an
API section, not the workspace `packages/` directory, and an earlier, broader
pattern flagged it.

**Confidence reads 1.00 for a page the model guessed its way through.**
OpenRouter fans one model id out over several upstream providers, and they do not
all mean the same thing by `logprobs: true`. See
`infrastructure/adapters/openrouter/logprob-confidence.ts` and `docs/MODELS.md`
before changing a model.

## Working on a task

1. Reproduce it. A bug that has not been seen locally has not been understood.
2. Get the real error — the stack, the query, the provider's actual answer — not
   the message the layer above rewrote it into.
3. Check `TECH_DEBT.md` first. Half of what looks like a bug is a compromise
   already written down, and the entry says what to do when it fires.
4. Find the cause before changing anything. A test that goes green because a
   condition was loosened has hidden the bug, not fixed it.
5. Fix it where it belongs — the layer that owns the decision, not the layer
   where it surfaced — and cover it with a test in the set that matches
   (`reference/testing.md`): domain rule → unit, database or wiring →
   integration.
6. A test guarding a fixed bug carries a comment saying which bug, so the next
   optimisation does not quietly restore it.

## Before saying it is done

```bash
pnpm lint
pnpm prettier:check
pnpm typecheck
pnpm build
pnpm test              # unit
pnpm test:integration  # needs docker
pnpm test:api          # needs docker; runs the built server as its own process
```

`API_SERVER_LOGS=1 pnpm test:api` streams the server's output into the run —
the harness otherwise keeps it back and prints it only if start-up fails.

Say which of these were run and what they said. A failing test is a result to
report, not a step to repeat until it passes.

## Conventions

- **English** for code, identifiers, domain terms, test names and these
  documents. A translated domain term is a different term.
- **Comments explain the decision, not the action.** What the code does is
  visible in the code. Write the comment when the next reader would otherwise
  conclude this is a mistake — and reference the ADR by number.
- **Conventional commits**, one step per commit. Mechanical renames go in their
  own commit, separate from changes to content: otherwise the history is
  unreadable and the review is impossible.
- **A decision worth an argument becomes an ADR** — `docs/adr/` for the system,
  `packages/verification/docs/adr/` for the context, numbering continuous across
  both. An accepted ADR is not rewritten; it is superseded, and the new one says
  what it replaced.
- **Never silence a boundary with a lint-disable.** It is either a mistake or an
  ADR.
