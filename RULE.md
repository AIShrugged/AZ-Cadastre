# Monorepo Rules

High-level rules for splitting a TypeScript monorepo into bounded contexts, contracts,
shared kernel and a composition root. Written to be reusable as a refactoring brief for
another project — nothing here is specific to one domain.

Written in English on purpose: this file is meant to be pasted as a prompt.

---

## 1. Three kinds of projects, and only three

```
apps/*        deployables. Composition roots + UI. No business rules.
packages/*    bounded contexts. Own language, own model, own database.
libs/*        everything that is not a context: contracts, kernel, adapters, engines.
```

Every project is a real package (`package.json`, own `tsconfig`, own build) and is imported
**by package name** (`@org/x`), never by relative path across project boundaries. Relative
paths that escape a project (`../../packages/iam`) defeat every boundary check you will write.

Tag each project with its type. Tags are the vocabulary the dependency rule is written in:

| Tag              | Where                          | Meaning                                              |
| ---------------- | ------------------------------ | ---------------------------------------------------- |
| `type:context`   | `packages/*`                   | bounded context — has its own ubiquitous language    |
| `type:edge`      | `libs/api-gateway`             | transport façade (HTTP/GraphQL/CLI). No domain logic |
| `type:contracts` | `libs/api-contracts`           | published language between contexts                  |
| `type:kernel`    | `libs/shared`                  | shared kernel — tactical DDD blocks only             |
| `type:adapter`   | `libs/logger`, `libs/cache`, … | technical capability behind a port                   |
| `type:engine`    | `libs/*-engine`                | pure computation, zero framework, runs anywhere      |

Second tag axis: deployment (`deployment:monolith`, `deployment:microservices`). It lets you
run/build a subset without changing code, and it is the thing that makes "extract a service
later" a wiring change rather than a rewrite.

---

## 2. The dependency rule

One direction, no exceptions:

```
apps/*            →  may import anything
type:context      →  contracts, kernel, adapters        (never another context)
type:edge         →  contracts, kernel, adapters        (never a context's internals)
type:contracts    →  kernel only
type:adapter      →  kernel only
type:kernel       →  nothing in the workspace
type:engine       →  nothing at all (not even the kernel, ideally)
```

Two contexts never import each other. Ever. Cross-context traffic goes through a port typed
by the contracts package and bound in the composition root.

**Enforce it mechanically or it will not hold.** Either nx `onlyDependOnLibsWithTags`, or —
if your linter has no graph awareness — an ESLint/oxlint `no-restricted-imports` override per
layer: ban the whole `@org/*` scope and re-allow by negation what the layer may use.

```jsonc
// .oxlintrc.json — one override per layer
{
  "files": ["packages/*/**/*.ts", "libs/api-gateway/**/*.ts"],
  "rules": {
    "no-restricted-imports": [
      "error",
      {
        "patterns": [
          {
            "group": [
              "@org/*",
              "!@org/api-contracts",
              "!@org/api-contracts/*",
              "!@org/shared",
              "!@org/logger",
              "!@org/cache",
            ],
            "message": "Route cross-context traffic through @org/api-contracts.",
          },
        ],
      },
    ],
  },
}
```

Caveat to state out loud in the config: this checks _package names_, so it only works if
rule #1 (no cross-project relative imports) holds.

---

## 3. Bounded contexts (`packages/*`)

### What makes one

A context is a **language boundary**, not a folder of related features. Split when the same
word means two different things on either side, or when the model would have to grow flags to
serve both sides. Do not split by entity, by layer, or by team calendar.

If you cannot write one paragraph describing the context's job without saying "and also",
it is two contexts. If two candidate contexts share the same aggregates, it is one.

### Internal shape

```
packages/<context>/
  CONTEXT.md              ubiquitous language + invariants
  docs/adr/               decisions local to this context
  src/
    domain/               entities, value objects, domain events, domain services.
                          Zero framework imports. Readable without knowing the ORM.
    application/
      ports/inbound/      what this context offers  (abstract class = DI token)
      ports/outbound/     what this context needs from others
      use-cases/          one file per operation (command/query handler)
      services/           thin façades that implement the inbound port
    infrastructure/       persistence, messaging, generated ORM client, migrations
    index.ts              the entire public surface
```

Layering is hexagonal; `application` may be CQRS (one handler per operation) — say so in an
ADR, including that it is handler-level only, sharing one database and one set of ORM models,
with no read models and no event sourcing, if that is what you mean. Otherwise someone will
build an event store.

### Public surface

`src/index.ts` exports **exactly three things**:

```ts
export { InboundPort, OutboundPort } from "./application/ports/index.js"; // DI tokens
export { ContextModule } from "./context.module.js"; // wiring
export type { ContextModuleOptions } from "./context.module-defs.js"; // config shape
```

Entities, use cases, repositories, ORM types: never exported. If another project needs a
shape, it belongs in contracts as a DTO.

### Ports

Ports are **abstract classes**, not interfaces — you need a runtime value as a DI token. They
mirror the contract interface so the compiler keeps them honest:

```ts
// application/ports/inbound/organization.port.ts
export abstract class OrganizationApiPort implements OrganizationApi {
  abstract readonly projects: OrganizationApi["projects"];
  abstract readonly tasks: OrganizationApi["tasks"];
}

// application/ports/outbound/iam.port.ts — only the slices this context actually needs
export abstract class IamPort {
  abstract readonly memberships: IamApi["memberships"];
}
```

The inbound port is implemented by one façade service that delegates to per-area services,
each of which implements its contract interface and does nothing but dispatch to a use case.
That façade is the only class in the context that knows the whole API surface.

### Database

One database (or at minimum one schema) per context. No cross-context joins, no foreign keys
across the boundary — hold the other side's id as a plain value. Migrations live inside the
context.

---

## 4. `libs/api-contracts` — the published language

The single place where contexts, the gateway, and the web client agree on shapes. Both sides
of every call import from here; a context may never declare a cross-context message locally.

```
src/<context>/
  api/       interfaces:  ProjectsApi { findOne(dto): Promise<ProjectDto | null> }
  dto/       zod schemas + inferred types
  enums/     shared enums and their zod schemas
  events/    integration event payloads + their pattern/topic names
  patterns.ts  RPC pattern constants
src/shared/  primitives used by more than one context's DTOs
```

Rules:

- **Zod-first.** `export const xSchema = z.object({...}); export type XDto = z.infer<typeof xSchema>;`
  The contract is then checked at compile time _and_ validated at runtime, from one source.
- **Subpath exports per context** (`@org/api-contracts/iam`, `.../organization`,
  `.../iam/events`). Consumers import only the slice they need.
- **No server dependencies.** The frontend consumes this package. Keep it at `zod` and
  plain TS — no Nest, no ORM, no node built-ins. Frontend forms build from the contract
  schemas (`.extend()` for messages, `.omit()` for gateway-supplied fields) instead of
  duplicating them.
- **Breaking a contract breaks every consumer's build.** That is the point. The cost is that
  contracts cannot be versioned independently — incompatible changes ship all at once.
  Accept it in a monorepo; if you cannot, you needed separate repos.
- What does **not** go here: internal request/response types, transport envelopes, anything
  only one context uses.

---

## 5. `libs/shared` — the shared kernel

The kernel is the smallest thing that survives at the bottom of the stack. It depends on
nothing in the workspace, and everything may depend on it. That makes every addition
permanent — so the bar is high.

Admit only **tactical DDD building blocks whose semantics are identical in every context**:

```
domain/        AggregateRoot, DomainEvent, base value objects (Id, Money, DateRange)
application/   IntegrationEvent, DomainEventPublisher port, EventPublisher port
exceptions/    Domain/Application/Infrastructure exception bases
```

Rejected on sight: transport envelopes, context-local request types, "utils", helpers used
by two places, anything named `common`, anything with a framework import.

Test for admission: _would every context implement this identically, with the same meaning?_
If no — duplicate it. Two similar 20-line classes in two contexts is cheaper than one shared
class that both must bend around.

---

## 6. Composition root (`apps/server`)

The only place in the system that knows every context exists. It contains **no business
logic** — four files is a healthy size:

```
apps/server/src/
  main.ts                bootstrap, transports, global pipes
  server.module.ts       imports every context module, passes config
  config/env.schema.ts   env validated by a schema at startup, typed thereafter
  infrastructure/index.ts  port → implementation bindings
```

Every cross-context port is bound here, and nowhere else:

```ts
export const LOCAL_PROVIDERS: Provider[] = [
  { provide: IamClientPort, useExisting: IamApiPort }, // gateway → iam
  { provide: OrganizationClientPort, useExisting: OrganizationApiPort },
  { provide: IamPort, useExisting: IamApiPort }, // organization → iam
];
```

This file is the extraction seam: **when a context becomes its own service, only these
bindings change** from in-process `useExisting` to an RPC client. Nothing in `packages/*`
moves. If extracting a context would require touching anything other than the composition
root and deployment config, the boundary is wrong.

Config flows one way: the root reads and validates env, then hands each module a typed slice
via `forRootAsync`. Contexts never read `process.env`.

---

## 7. Edge, adapters, engines

**Edge (`libs/api-gateway`).** One HTTP/GraphQL façade. Translates transport into port calls
and back. Owns auth guards, dataloaders, transport DTOs and error mapping. Has no language of
its own — it never invents a term the contracts do not have — and imports contexts only
through the client ports it declares in its own `application/ports`. Organize by context:
`presentation/<context>/{gql,rest}/<resource>/*.resolver.ts`.

**Adapters (`libs/logger`, `libs/cache`, `libs/event-publisher`).** A technical capability
expressed as a port plus one implementation. Swapping Redis for something else must touch one
package. Adapters are the one thing contexts may import directly, because they carry no
domain meaning.

**Engines (`libs/*-engine`).** Pure computation with an empty `dependencies` block — a
scheduler, a pricing calculator, a rules evaluator. Because it is pure, it runs on the server
and in the browser from the same source, which is usually why you extracted it. Frameworks
and I/O in an engine are a bug.

---

## 8. Docs that keep the boundaries honest

- **`CONTEXT-MAP.md` (root).** Lists contexts, what is deliberately _not_ a context, the
  relationships between them (which is upstream, which is a customer, what handshake exists),
  and — most valuable — a **language conflict table**: words meaning different things in
  different contexts. Those words must be translated at the boundary, never reused.
- **`packages/<ctx>/CONTEXT.md`.** The ubiquitous language of that context: term, definition,
  and an explicit `Avoid:` list of near-synonyms that must not appear in code. This is what
  makes naming reviewable instead of arguable.
- **ADRs.** Root `docs/adr/` for system-wide decisions (database-per-context, hexagonal+CQRS,
  contracts-as-wire-format). `packages/<ctx>/docs/adr/` for decisions inside one context.
  Every ADR states the alternative rejected and a **Consequences** section that admits the
  cost. An ADR with no downside listed is marketing.

---

## 9. Working rules

**Adding an operation** — the path is always the same:

1. DTO + schema in `api-contracts/<ctx>/dto`, method on the `…Api` interface.
2. Use case (command/query + handler) in the context's `application/use-cases`.
3. Context service method implementing the contract interface, dispatching to the bus.
4. Resolver/controller in the gateway calling the client port.
5. Nothing new in `index.ts`, nothing new in the composition root.

**Adding a context:** write `CONTEXT.md` first, then the row in `CONTEXT-MAP.md` (including
its relationships), then the package with tags and lint override, then the module, then the
first port binding in the composition root.

**Cost to accept up front:** more files per feature (a CRUD entity costs ~6), contracts that
break every consumer at once, and CQRS ceremony on operations that do not need it. These are
chosen, not accidental — write them into the ADRs so nobody "fixes" them later.

---

## 10. Smell list

| Smell                                                   | What it means                                    |
| ------------------------------------------------------- | ------------------------------------------------ |
| Context imports another context                         | Boundary violated. Introduce an outbound port.   |
| A context's `index.ts` exports an entity or repository  | Public surface has leaked.                       |
| DTO declared inside a context but crossing the boundary | Belongs in contracts.                            |
| `libs/shared` grows a `utils/` or `common/` folder      | Kernel is becoming a dumping ground.             |
| Kernel imports a framework                              | Kernel is no longer the bottom of the stack.     |
| Composition root contains an `if` about business rules  | Logic escaped into wiring.                       |
| Gateway invents a term contracts do not have            | Edge grew a model.                               |
| Two contexts write the same table                       | It is one context, or the boundary is misplaced. |
| Extracting a context would touch many files             | Coupling is real, not just structural.           |
| Relative import escaping a package                      | Lint boundaries are blind to it — always ban it. |
