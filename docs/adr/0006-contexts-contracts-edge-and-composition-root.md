# Contexts in `packages/`, one published language, an edge, and a composition root that binds

Supersedes the layout half of [ADR-0005](./0005-bounded-context-packages.md). The context is still a package with a domain model at its centre and still owns its database; what changed is where it sits, what it exposes, and who owns the transport.

`libs/` had come to mean three unrelated things at once. It held the verification context, the wire contracts, two shared backend packages, and would have held the next context too — so "which of these may import which" could not be read off a path, and the one boundary the dependency rule cares about (a context) looked exactly like the one it does not (a technical capability). The tree now says it out loud:

```
apps/*        deployables — composition roots and UI. No business rules.
packages/*    bounded contexts. Own language, own model, own database.
libs/*        everything that is not a context: contracts, kernel, edge, adapters.
```

Every project carries its tags under `nx.tags` in its `package.json` (`type:context`, `type:edge`, `type:contracts`, `type:kernel`, `type:adapter`, plus a `deployment:` axis), and the boundary is enforced mechanically rather than by review: `.oxlintrc.json` bans the whole `@cadastre/*` scope per layer and re-allows by negation what that layer may use, and bans relative imports that escape a package, because the first rule only sees package names. Note that `no-restricted-imports` does not merge across overrides — the last match wins outright — so the escape ban is repeated into every layer rather than declared once.

The tags earn their keep beyond the lint rule: nx resolves `-p tag:deployment:monolith` into a project set, which is what makes running or building a subset a selector rather than a code change.

Four things moved with it.

**The context stopped owning HTTP.** `api/http/` left `packages/verification/` for `libs/api-gateway/` (`type:edge`), which reaches the context through a `VerificationClientPort` it declares itself and never names a context class. The context now offers a `VerificationApiPort` — an abstract class, so it is a DI token — implemented by a façade service that delegates to one thin service per area. The presenters moved with those services: turning a read model into a DTO is the context's job, because the DTO is the contract and the read model is not.

**`index.ts` shrank to three exports** — the inbound port, the module, the options type. Commands, queries and `PackageId` used to be exported so a controller could construct them; with the controller behind a port, nothing outside needs them. An aggregate, a use case or an ORM type in that file is now visibly wrong rather than arguably fine.

**Contracts became the published language rather than a bag of DTOs.** `libs/api-contracts/` is sliced per context (`@cadastre/api-contracts/verification`, `.../shared`) and holds the `…Api` interfaces both sides implement — the context's service and the gateway's port — so a change to either shape fails to compile on the other. Enums moved out of the DTO files they happened to be declared in.

**Configuration flows one way.** `apps/server/` validates the whole environment once against one schema and hands the context a typed slice through `VerificationModule.forRootAsync`; the context's own `ConfigModule` and env schema are gone, and nothing under `packages/` reads `process.env`. The port bindings live in `apps/server/src/infrastructure/index.ts` and nowhere else — that file is the extraction seam, and making verification a separate service means changing `useExisting` to an RPC client there and moving nothing.

The two shared backend packages became one. `@cadastre/kernel` and `@cadastre/application` split along a line that stopped being true when `application` held a single class: the kernel is the bottom of the stack, and there was no second thing under it. They are now `@cadastre/shared`, with `domain/`, `application/` and `exceptions/`. The one framework import that merge would have dragged in — `DomainEventDispatcher` needed the Nest CQRS bus — became a `DomainEventPublisher` port in the kernel and a `@cadastre/event-publisher` adapter beside it, so the bottom of the stack imports nothing at all.

**Alternative rejected:** leaving the context where it was and enforcing the boundary by review, which is what the previous layout did. It survived one context. The reason to pay now rather than at the second context is that the second context is when a cross-context import is first *possible*, and by then the wrong version of every one of these files exists.

**Consequences.** A CRUD operation now costs more files than before: a DTO and an `…Api` method in contracts, a use case, a service method, a controller — and the service is often a single line of delegation. The façade in the middle is real indirection with no behaviour in it, and it exists so the gateway can be told about a port instead of a class. Contracts still cannot be versioned independently, so an incompatible change breaks the web client's build in the same commit; that is the point of a monorepo and the reason not to reach for one when it is not. The composition root now knows the environment of every context, which makes it the one file that must change when any context gains a setting.
