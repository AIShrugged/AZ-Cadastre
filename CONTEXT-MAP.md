# Context map

What is a bounded context here, what deliberately is not, and which words change meaning when they cross a boundary. Kept at the root because it is the only document that is about the boundaries rather than about one side of them.

## Contexts

| Context          | Package                  | Its job                                                                                                                                                 |
| ---------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Verification** | `packages/verification/` | Takes files an inspector submitted under a Verification Profile, reads them into the documents they hold, and reports what it found and how sure it is. |

One context, on purpose. The system does one thing, and a second context would today be a folder of related features rather than a second language. Its ubiquitous language is in [`packages/verification/CONTEXT.md`](./packages/verification/CONTEXT.md); the decisions local to it are in `packages/verification/docs/adr/`.

## Deliberately not contexts

| Project                 | Tag              | Why it is not a context                                                                                                                                                                                                                                                  |
| ----------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `libs/api-contracts/`   | `type:contracts` | The published language _between_ contexts, not a language of its own. It invents no term; every name in it is a context's name, promoted so both sides can see it.                                                                                                       |
| `libs/api-gateway/`     | `type:edge`      | Transport. It translates HTTP into port calls and status codes back, and it must never hold a word the contracts do not have.                                                                                                                                            |
| `libs/shared/`          | `type:kernel`    | Tactical building blocks whose meaning is identical everywhere: `AggregateRoot`, `EntityId`, `DomainEvent`, the exception bases, the publisher port. No domain concept lives here — if only one context needs it, it stays in that context.                              |
| `libs/event-publisher/` | `type:adapter`   | A technical capability behind a port. Carries no domain meaning, which is why a context may import it directly.                                                                                                                                                          |
| `libs/logger/`          | `type:adapter`   | The same, for logging: the `Logger` port and its pino adapter. A context may import it; `domain/` may not, because a rule that logs has grown a collaborator (ADR-0008).                                                                                                 |
| `apps/server/`          | `type:app`       | The composition root. It knows every context exists; it knows nothing about what they mean.                                                                                                                                                                              |
| `libs/api-client/`      | `type:client`    | The published API as a caller outside the system sees it, typed by the contracts. Used by the API tests; a context may not import it, which is the lint form of "a context never calls another synchronously".                                                           |
| `apps/web/`             | `type:app`       | The inspector's client. It speaks the contracts and never the domain model.                                                                                                                                                                                              |
| `apps/registry-stub/`   | `type:app`       | The stand-in for the archive register — a system outside this one, reached over HTTP. It speaks the contracts, decides nothing, and is deleted rather than migrated when a real register answers them (ADR-0009).                                                        |
| `libs/matching-engine/` | `type:engine`    | Pure rules: whether two ways of writing an address, a name, an area or a reference number mean the same thing, including the Azerbaijani legacy Cyrillic table the archive files need. No dependencies, so the stand-in and whatever replaces it answer from one source. |

## Relationships

```
apps/web  ──HTTP──▶  libs/api-gateway  ──VerificationClientPort──▶  packages/verification
                            ▲                                              ▲   │
                            └────── @cadastre/api-contracts ───────────────┘   │ ArchiveRegistryPort
                                    (the language both sides speak)            │
                                                                               ▼
                                                            apps/registry-stub  ──▶  libs/matching-engine
                                                            (a stand-in for a system
                                                             outside this one)
```

**The archive register is upstream of verification, and outside the system.** It
is not a context and never becomes one while we hold no data: `apps/registry-stub`
answers `@cadastre/api-contracts/registry` from fixtures until either the 55
register files are ingested or a real state register appears (ADR-0009). What
crosses that boundary is facts — what the register holds — never a verdict about
a submission, because the register does not know what is being registered.

**Verification is upstream; the gateway is its customer.** The gateway takes the language as verification publishes it and translates nothing back — a conformist relationship, and a deliberate one: there is one client, and giving it an anticorruption layer would buy nothing but a second set of names.

The handshake is `libs/api-contracts/src/verification/api/` — the `…Api` interfaces. The context's façade service implements them; the gateway's `VerificationClientPort` mirrors them. Neither side can change shape without failing the other's build. The binding between the two is made once, in `apps/server/src/infrastructure/index.ts`, and is the only thing that changes if verification becomes its own service.

## Language conflicts

Words that already mean two things, and must be translated at the boundary rather than reused:

| Word         | In verification                                                                                                                       | Elsewhere                                                                                                                        | Rule at the boundary                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Document** | A _logical_ document found inside an uploaded file: a contiguous run of pages carrying one Document Type. Discovered, never declared. | To an inspector, and in most of the world, a document is the file they attached.                                                 | The file is a **Source File** in code and in the contract. Never let "document" mean the upload.                                                                                                                                                                                                                                                                                                                         |
| **Package**  | A Verification Package — the set of files submitted together for one verification.                                                    | An npm workspace package. Both appear in the same sentence in this repo.                                                         | `PackageDto`, `PackagesApi`, `use-cases/packages/` are the domain; the workspace directory `packages/` is not. Never name a workspace concept `Package…` inside `packages/verification/`. This collision is not theoretical: the boundary rule that bans relative imports escaping a project used to match any path containing `packages/`, and flagged the API section for being spelled like the directory (ADR-0007). |
| **Status**   | `PackageStatus` is where a run got to: `Pending → Processing → Completed \| Failed`.                                                  | `ReportStatus` is what the run _found_: `OK`, `IssuesFound`, `IncompletePackage`. A run that finished is `Completed` either way. | Never expose one as "status" unqualified. Both enums are named in `api-contracts/verification/enums/`.                                                                                                                                                                                                                                                                                                                   |
| **Profile**  | A Verification Profile: the rules a submission is judged against. Lives in code, not the database (ADR-0002).                         | A user profile, in every other system.                                                                                           | There are no user accounts here yet. When there are, the other one is a **Member** or an **Account**, never a profile.                                                                                                                                                                                                                                                                                                   |
| **Field**    | An Extracted Field — a value read off a document, always with a confidence and a page reference.                                      | A form field in the web client.                                                                                                  | `FieldDto` is always the extracted one. The client's inputs are not fields in any shared name.                                                                                                                                                                                                                                                                                                                           |

## How the relationships are enforced

None of the above is a convention. Every arrow and every absence of one has an
entry in `.oxlintrc.json`, written as `no-restricted-imports` overrides **by
folder**:

| What is enforced                                                                   | Where it is written                                                                    |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| a context and the edge may reach only contracts, the kernel and technical adapters | override on `packages/*/**` and `libs/api-gateway/**`                                  |
| an engine reaches nothing at all — no workspace package, no framework, no zod      | override on `libs/matching-engine/**` (RULE.md §7)                                     |
| contracts and adapters may reach only the kernel                                   | override on `libs/api-contracts/**`, `libs/event-publisher/**`                         |
| the kernel reaches nothing in the workspace                                        | override on `libs/shared/**`                                                           |
| `domain/` reaches no sibling layer, no Nest, no Prisma, no provider SDK            | override on `packages/*/src/domain/**` (ADR-0007)                                      |
| `domain/` may not import a technical adapter either — logging included             | the same override, whose allow-list names only the contracts and the kernel (ADR-0008) |
| `application/` reaches no `infrastructure/` or `presentation/`                     | override on `packages/*/src/application/**` (ADR-0007)                                 |
| no relative path escapes its project                                               | a pattern in every override, matching a literal `..` before a workspace root           |

Each message names the rule, names the way out and cites the ADR behind it — a
rule whose reason is not one click away gets worked around with a relative path
rather than understood. The checks are run by CI, not only by the commit hook,
because `--no-verify` removes the hook.

What the linter still cannot see is listed in `reference/boundaries.md`: a
dependency taken at runtime through a string token, and one context reading
another's table while the database is physically one. The first is why every
injection token in this repository is an abstract class; the second is why a
context owns its database.

## Adding a context

Write its `CONTEXT.md` first, then its row and its language conflicts above, then the package with its tags and its lint override, then the module — and only then the first port binding in `apps/server/src/infrastructure/index.ts`. If the paragraph describing its job needs the words "and also", it is two contexts; if it shares an aggregate with an existing one, it is not a new context at all.
