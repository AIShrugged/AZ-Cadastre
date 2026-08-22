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

## Rakes already stepped on

Each of these cost real time. The symptom is what you will see; the cause is why.

**A Nest dependency is `undefined` at call time, and the container said nothing.**
_2026-08-22._ vitest transforms TypeScript with esbuild, and esbuild has never
implemented `emitDecoratorMetadata`. Under the test runner no class carries
`design:paramtypes`, so Nest resolves every constructor parameter without an
explicit `@Inject` to `undefined` — and the module still builds. The failure
surfaces much later, as a handler calling a method on nothing. Two defences, and
both are in place: the integration set transforms with swc
(`vitest.integration.config.ts`), and every parameter typed by an abstract port
carries `@Inject(Port)`. Add the decorator on new ports too; it is not optional
(application.md), and it is what makes the wiring independent of a compiler flag.
The same helper is why `test/setup.ts` imports `reflect-metadata` first:
TypeScript's `__metadata` checks `typeof Reflect.metadata === 'function'` and
_silently does nothing_ when it is not there yet.

**`Cannot find module '@cadastre/shared'` right after a clean.** _2026-08-22._
The packages build in `composite` mode, so `tsc` trusts
`tsconfig.build.tsbuildinfo` for its up-to-date check. Delete `build/` and leave
the fingerprint and `tsc` concludes there is nothing to emit — the next package
then cannot find the `.d.ts` and nothing says why. They are one artefact. If you
clean by hand, remove both; nx caches them together (`nx.json`), so
`pnpm build` after a cache restore is safe.

**A test asserts on a fresh package and passes only sometimes.** _2026-08-22._
Submitting a package raises `PackageSubmitted`, and the context reacts by
starting the verification run — fire and forget, because the pipeline outlives
the request that asked for it. A test that reads the package straight after
creating it is racing the context. Use `waitForTerminalStatus` from
`packages/verification/test/context-harness.ts`.

**`pnpm typecheck` fails on a fresh clone with "Cannot find module
@cadastre/shared".** _2026-08-22._ Typecheck is not a standalone check here:
applications import the `build/` of a package, not its source (ADR-0006), so
checking types needs the `.d.ts` of everything below. It is an nx target with
`dependsOn: ["^build"]` for exactly this reason — run `pnpm typecheck`, not
`pnpm -r typecheck`, and nx builds what it needs first.

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
```

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
