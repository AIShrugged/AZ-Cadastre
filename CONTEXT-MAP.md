# Context map

What is a bounded context here, what deliberately is not, and which words change meaning when they cross a boundary. Kept at the root because it is the only document that is about the boundaries rather than about one side of them.

## Contexts

| Context          | Package                  | Its job                                                                                                                                                 |
| ---------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Verification** | `packages/verification/` | Takes files an inspector submitted under a Verification Profile, reads them into the documents they hold, and reports what it found and how sure it is. |

One context, on purpose. The system does one thing, and a second context would today be a folder of related features rather than a second language. Its ubiquitous language is in [`packages/verification/CONTEXT.md`](./packages/verification/CONTEXT.md); the decisions local to it are in `packages/verification/docs/adr/`.

## Deliberately not contexts

| Project                 | Tag              | Why it is not a context                                                                                                                                                                                                                     |
| ----------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `libs/api-contracts/`   | `type:contracts` | The published language _between_ contexts, not a language of its own. It invents no term; every name in it is a context's name, promoted so both sides can see it.                                                                          |
| `libs/api-gateway/`     | `type:edge`      | Transport. It translates HTTP into port calls and status codes back, and it must never hold a word the contracts do not have.                                                                                                               |
| `libs/shared/`          | `type:kernel`    | Tactical building blocks whose meaning is identical everywhere: `AggregateRoot`, `EntityId`, `DomainEvent`, the exception bases, the publisher port. No domain concept lives here — if only one context needs it, it stays in that context. |
| `libs/event-publisher/` | `type:adapter`   | A technical capability behind a port. Carries no domain meaning, which is why a context may import it directly.                                                                                                                             |
| `apps/server/`          | `type:app`       | The composition root. It knows every context exists; it knows nothing about what they mean.                                                                                                                                                 |
| `apps/web/`             | `type:app`       | The inspector's client. It speaks the contracts and never the domain model.                                                                                                                                                                 |

## Relationships

```
apps/web  ──HTTP──▶  libs/api-gateway  ──VerificationClientPort──▶  packages/verification
                            ▲                                              ▲
                            └────── @cadastre/api-contracts ───────────────┘
                                    (the language both sides speak)
```

**Verification is upstream; the gateway is its customer.** The gateway takes the language as verification publishes it and translates nothing back — a conformist relationship, and a deliberate one: there is one client, and giving it an anticorruption layer would buy nothing but a second set of names.

The handshake is `libs/api-contracts/src/verification/api/` — the `…Api` interfaces. The context's façade service implements them; the gateway's `VerificationClientPort` mirrors them. Neither side can change shape without failing the other's build. The binding between the two is made once, in `apps/server/src/infrastructure/index.ts`, and is the only thing that changes if verification becomes its own service.

## Language conflicts

Words that already mean two things, and must be translated at the boundary rather than reused:

| Word         | In verification                                                                                                                       | Elsewhere                                                                                                                        | Rule at the boundary                                                                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document** | A _logical_ document found inside an uploaded file: a contiguous run of pages carrying one Document Type. Discovered, never declared. | To an inspector, and in most of the world, a document is the file they attached.                                                 | The file is a **Source File** in code and in the contract. Never let "document" mean the upload.                                                                           |
| **Package**  | A Verification Package — the set of files submitted together for one verification.                                                    | An npm workspace package. Both appear in the same sentence in this repo.                                                         | `PackageDto`, `PackagesApi`, `packages/` — the first two are the domain, the last is the workspace. Never name a workspace concept `Package…` in `packages/verification/`. |
| **Status**   | `PackageStatus` is where a run got to: `Pending → Processing → Completed \| Failed`.                                                  | `ReportStatus` is what the run _found_: `OK`, `IssuesFound`, `IncompletePackage`. A run that finished is `Completed` either way. | Never expose one as "status" unqualified. Both enums are named in `api-contracts/verification/enums/`.                                                                     |
| **Profile**  | A Verification Profile: the rules a submission is judged against. Lives in code, not the database (ADR-0002).                         | A user profile, in every other system.                                                                                           | There are no user accounts here yet. When there are, the other one is a **Member** or an **Account**, never a profile.                                                     |
| **Field**    | An Extracted Field — a value read off a document, always with a confidence and a page reference.                                      | A form field in the web client.                                                                                                  | `FieldDto` is always the extracted one. The client's inputs are not fields in any shared name.                                                                             |

## Adding a context

Write its `CONTEXT.md` first, then its row and its language conflicts above, then the package with its tags and its lint override, then the module — and only then the first port binding in `apps/server/src/infrastructure/index.ts`. If the paragraph describing its job needs the words "and also", it is two contexts; if it shares an aggregate with an existing one, it is not a new context at all.
