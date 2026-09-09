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
| `apps/registry-stub/`   | `type:app`       | The stand-in for the archive register — a system outside this one, reached over HTTP and holding its own database. It speaks the contracts, decides nothing, and is deleted rather than migrated when a real register answers them (ADR-0009, ADR-0010).                 |
| `libs/matching-engine/` | `type:engine`    | Pure rules: whether two ways of writing an address, a name, an area or a reference number mean the same thing, including the Azerbaijani legacy Cyrillic table the archive files need. No dependencies, so the stand-in and whatever replaces it answer from one source. |

## Relationships

```
apps/web  ──HTTP──▶  libs/api-gateway  ──VerificationClientPort──▶  packages/verification
                            ▲       │                                          │
                            └────── │ ─── @cadastre/api-contracts ─────────────┘
                                    │     (the language every arrow is drawn in)
                                    │                                          │
                     RegistryClientPort                          ArchiveRegistryPort
                                    │                                          │
                                    └──────▶  apps/registry-stub  ◀────────────┘
                                              (a stand-in for a system
                                               outside this one)
                                                       │
                                                       ▼
                                              libs/matching-engine
```

**The archive register is upstream of verification, and outside the system.** It
is not a context and never becomes one while we hold no data: `apps/registry-stub`
answers `@cadastre/api-contracts/registry` until either the 55 register files are
ingested or a real state register appears (ADR-0009). What crosses that boundary
is facts — what the register holds about a property, which of its papers the
archive has, and how much of the archive is loaded at all — never a verdict
about a submission or about itself, because the register does not know what is
being registered and does not know what a caller needs before searching is worth
anything.

**Two callers ask it, and neither goes through the other.** Verification asks on
a submission's behalf, as one stage of a run; the edge asks on the operator's
behalf, for the archive-search screen and for the sidebar's archive band. Each
declares an outbound port over the slices it actually calls —
`ArchiveRegistryPort` over `addresses` alone, `RegistryClientPort` over
`addresses`, `search` and `summary` — and the composition root binds both. The
two ask different questions of one register on purpose: `addresses` resolves a
submission's address to the one record a stage may act on, `search` offers every
record that might be the one and grades how sure it is (ADR-0013). The edge deliberately does not reach the
register through the context: that would make the operator's search depend on
whether a submission's pipeline is running its register mocked, and would put a
context on the path of a question that is not about a submission at all.

It has a **database of its own**, `cadastre-registry`, with its own schema,
migration history and seed (ADR-0010). Not `cadastre-db`: that one belongs to
verification, which owns it, and two databases are what make a join between a
submission and the record of a registration a network call rather than a query
somebody can write by accident.

**Verification is upstream; the gateway is its customer.** The gateway takes the language as verification publishes it and translates nothing back — a conformist relationship, and a deliberate one: there is one client, and giving it an anticorruption layer would buy nothing but a second set of names.

The handshake is `libs/api-contracts/src/verification/api/` — the `…Api` interfaces. The context's façade service implements them; the gateway's `VerificationClientPort` mirrors them. Neither side can change shape without failing the other's build. The binding between the two is made once, in `apps/server/src/infrastructure/index.ts`, and is the only thing that changes if verification becomes its own service.

## Language conflicts

Words that already mean two things, and must be translated at the boundary rather than reused:

| Word         | In verification                                                                                                                                                                                                 | Elsewhere                                                                                                                                                                                                                                 | Rule at the boundary                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Document** | A _logical_ document found inside an uploaded file: a contiguous run of pages carrying one Document Type. Discovered, never declared.                                                                           | To an inspector, and in most of the world, a document is the file they attached.                                                                                                                                                          | The file is a **Source File** in code and in the contract. Never let "document" mean the upload.                                                                                                                                                                                                                                                                                                                         |
| **Package**  | A Verification Package — the set of files submitted together for one verification.                                                                                                                              | An npm workspace package. Both appear in the same sentence in this repo.                                                                                                                                                                  | `PackageDto`, `PackagesApi`, `use-cases/packages/` are the domain; the workspace directory `packages/` is not. Never name a workspace concept `Package…` inside `packages/verification/`. This collision is not theoretical: the boundary rule that bans relative imports escaping a project used to match any path containing `packages/`, and flagged the API section for being spelled like the directory (ADR-0007). |
| **Status**   | `PackageStatus` is where a run got to: `Pending → Processing → Completed \| Failed`.                                                                                                                            | `ReportStatus` is what the run _found_: `OK`, `IssuesFound`, `IncompletePackage`. A run that finished is `Completed` either way.                                                                                                          | Never expose one as "status" unqualified. Both enums are named in `api-contracts/verification/enums/`.                                                                                                                                                                                                                                                                                                                   |
| **Standing** | A Package Standing is what has to happen to a submission next, written for the inspector: `Queued`, `UnderVerification`, `Stalled`, `ShortOfDocuments`, `NeedsInspector`, `AwaitingArchiveApproval`, `Cleared`. | The **third** state here a reader will call a status, and the one they mean when they ask what the status of an application is. `apps/web` also holds a `Disposition` of its own, invented client-side before there was anything to read. | Derived from the two above, from what the archive register was asked, and from whether an approval of its answers is still in force — never stored and never set by hand (ADR-0014, ADR-0016). `PackageStandingSchema` in `api-contracts/verification/enums/` is the one of the three a client shows; the web client's `Disposition` is a view-model word that it supersedes.                                            |
| **Approval** | An Archive Search Approval is a person's sign-off on what the archive register answered about one submission, with the conclusion they drew from it.                                                            | The register approves nothing: it states what its own fonds hold and passes judgement on nobody's application (ADR-0009). "Approved" in the inspector's own speech also means the registration itself, which this system never decides.   | Always spelled as the approval of the **archive search**, never of the package or of the register. It carries no author because there are no accounts to read one from, and it is spent when the search is made again rather than left standing (ADR-0016).                                                                                                                                                              |
| **Profile**  | A Verification Profile: the rules a submission is judged against. Lives in code, not the database (ADR-0002).                                                                                                   | A user profile, in every other system.                                                                                                                                                                                                    | There are no user accounts here yet. When there are, the other one is a **Member** or an **Account**, never a profile.                                                                                                                                                                                                                                                                                                   |
| **Field**    | An Extracted Field — a value read off a document, always with a confidence and a page reference.                                                                                                                | A form field in the web client.                                                                                                                                                                                                           | `FieldDto` is always the extracted one. The client's inputs are not fields in any shared name.                                                                                                                                                                                                                                                                                                                           |

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
