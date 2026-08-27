# Layer boundaries are enforced by the linter, and a second test set answers for the database

Date: 2026-08-22. Status: accepted.

Extends [ADR-0006](./0006-contexts-contracts-edge-and-composition-root.md),
which drew the boundaries between projects. This one draws them **inside** a
project, and says who checks the parts neither ADR could.

## Context

ADR-0006 put the dependency rule between packages under `no-restricted-imports`,
and it has held. Inside a package nothing did. The four layers were a convention:
`domain/` importing Prisma, or `application/` importing an adapter, would have
passed lint, types and every test.

It had already drifted in three places, none of which anybody had noticed:

1. `VerificationPackageRepository` — a port — lived in `domain/repositories/`.
   The domain layer declared a collaborator it never calls.
2. `infrastructure/adapters/` was twenty flat files, seven of which were not
   adapters but rules: what makes two values off two papers the same value,
   whether a quotation is really on the page it claims, which type a text looks
   like by the profile's own headings. They imported nothing but domain value
   objects and were covered by unit tests — the domain was breaking in
   `infrastructure/`.
3. Nineteen constructor parameters typed by an abstract port had no `@Inject`,
   so the container was resolving them from `design:paramtypes`.

And below all of it: the only test set was unit. The Prisma mapper, the
repository adapter, the read-side SQL, the migration history and the Nest wiring
were covered by nothing. 627 unit tests could not answer whether the migrations
applied to an empty database.

## Decision

1. **Two lint overrides per context, in error.** `domain/**` may not import
   `application/`, `infrastructure/`, `presentation/`, Nest, Prisma, or a
   provider SDK. `application/**` may not import `infrastructure/` or
   `presentation/`. Both messages name the rule, name the way out, and cite an
   ADR — checked by introducing each violation and watching the rule fire.
2. **Ports live in `application/ports`.** The repository port moved there.
3. **Pure rules live in `domain/services/`.** The seven files moved; the
   OpenRouter specifics moved to `infrastructure/adapters/openrouter/`, so the
   folder names the provider.
4. **`@Inject(Port)` on every abstract-class parameter.** This is not style: it
   makes the wiring independent of `emitDecoratorMetadata`.
5. **An integration set, on Postgres in a container.** Migrations applied with
   `migrate deploy` to an empty database, the context assembled as the
   composition root assembles it, only `ObjectStorage` and `PdfSplitter`
   replaced, and every test going through the command and query buses. It is not
   cached by nx: a cache hit would report a pass for a database the run never
   spoke to.
6. **Each layer's barrel carries its own providers.** Which adapter answers which
   port is decided beside the adapter; the module composes the arrays.

What this does **not** change: the tree of ADR-0006, the single context, the
single contracts package, the in-process pipeline of ADR-0001, and the database
schema — no migration was written for any of it.

## Consequences

**The cost paid.** Two more lint overrides to keep correct as layers move; every
new port needs its `@Inject` written by hand, and forgetting it fails at call
time rather than at build time. `use-cases/` gained a grouping level, so paths
are one segment longer. Splitting the domain files by kind added 55 files and
made `git log --follow` the only readable way through that commit.

**The integration set costs a container.** It needs docker, it runs last in CI,
and it cannot be cached — so it is the slowest thing in the pipeline and it will
stay that way. A developer without docker can run everything except it. That is
the price of the schema being answered for by a real database rather than a mock,
and it is the right price.

**What is still not covered.** Nothing tests the process over HTTP, and nothing
drives a browser — the third and fourth sets of `reference/testing.md` do not
exist. `TECH_DEBT.md` entry 3 says how that fires.

**A trap the test runner set.** Nest resolves constructor parameters from
`design:paramtypes`, and vitest 3 transformed TypeScript with esbuild, which does
not emit it — so under the test runner every implicit injection was `undefined`
while the module still built. It was worked around with a swc transform, and
removed again when vitest 4 arrived on rolldown, which emits the metadata. The
decision that outlives both is point 4: an explicit `@Inject` does not care which
transform is in use.

**A trap this created.** Composite builds mean `tsc` trusts
`tsconfig.build.tsbuildinfo`. Deleting `build/` without it produces a silent
no-emit. nx caches the two together; a hand-clean must remove both. Written up in
`AGENTS.md`.
