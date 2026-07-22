# Spec: Domain Layer — Aggregate Roots

Status: ready-for-agent

## Problem Statement

The verification pipeline and the inspector-facing API both need a single, trustworthy model of what a Verification Package is: what state it is in, which Documents it contains, what was recognized and extracted, and what the final Verification Report says. Today nothing in `apps/core` enforces any of this — there is no domain layer, so every rule from the glossary and PRD (a package moves `Created → Processing → Completed/Failed`; a Document gets exactly one Document Type; an Extracted Field always carries value, confidence, and page reference; a report verdict must match its issues) would otherwise end up scattered across pipeline stages and controllers, duplicated and unenforceable. Pipeline stages are retryable by design (ADR-0001), so without a guarded model, a retried stage could silently corrupt package state.

## Solution

Introduce the `domain` layer of `apps/core` (ADR-0004): pure TypeScript, no framework imports, expressing the ubiquitous language from `CONTEXT.md` as code. It provides two aggregate roots — **Verification Package** and **Document** — plus the value objects they own (Page, Document Type, Extracted Field, Validation Issue, Verification Report) and a typed domain-error hierarchy. Every business rule above lives inside an aggregate and is impossible to bypass through the public API. The activity-shaped pipeline stages (ADR-0001) then become thin: load an aggregate by id, call a method, persist.

## User Stories

1. As an Inspector, I want every set of files uploaded together treated as one Verification Package, so that I review exactly one unit of work per submission.
2. As an Inspector, I want a Verification Package to always be in a known status (Created, Processing, Completed, Failed), so that I can tell from the dashboard whether a report is ready.
3. As an Inspector, I want a Completed package to be guaranteed to carry a Verification Report, so that I never open a finished package and find nothing to review.
4. As an Inspector, I want a Failed package to be terminal, so that I re-upload a corrected package instead of waiting on a stuck one.
5. As an Inspector, I want every Extracted Field to carry its value, confidence, and page number, so that I can jump from a report line to the exact page it came from.
6. As an Inspector, I want every Validation Issue tied to the document, page, and field it came from (where applicable), so that I can verify the finding against the source scan.
7. As an Inspector, I want the report verdict (OK, Issues Found, Incomplete Package) to be provably consistent with the report's issues, so that an "OK" verdict can never hide findings.
8. As an Inspector, I want a package with missing required documents to always read "Incomplete Package" rather than "Issues Found", so that completeness problems are impossible to miss.
9. As the verification pipeline, I want package status transitions enforced by the aggregate, so that a retried stage (ADR-0001) cannot move a package backwards or complete it twice.
10. As the verification pipeline, I want to record OCR text per Page through the Document aggregate, so that classification and extraction stages read from one consistent place.
11. As the verification pipeline, I want classification to assign a Document Type exactly once — Unknown included — so that a retried classify stage cannot flip an already-classified document.
12. As the verification pipeline, I want Extracted Fields attachable only to an already-classified Document, so that the pipeline order OCR → Classify → Extract (ADR-0003) is enforced by the model, not by convention.
13. As the verification pipeline, I want Documents referenced from their package by id only, so that per-document stages can run concurrently without contending on one giant aggregate.
14. As a developer, I want creating a Verification Package with zero documents to be rejected, so that empty submissions never enter the pipeline.
15. As a developer, I want duplicate document ids within a package rejected, so that a report can never double-count a document.
16. As a developer, I want a Document to reject file formats outside PDF/JPG/JPEG/PNG, so that unsupported uploads fail before OCR is attempted.
17. As a developer, I want duplicate page numbers within a Document rejected, so that page references in reports are unambiguous.
18. As a developer, I want confidence values constrained to the range 0–1 everywhere they appear, so that threshold rules in the future validation engine are meaningful.
19. As a developer adding a new domain (cadastre document sets), I want Document Types represented as profile-defined names rather than a hardcoded enum, so that a new Verification Profile requires no engine or domain change (ADR-0002).
20. As a developer, I want the domain layer free of NestJS, zod, and `@cadastre/contracts` imports, so that it stays unit-testable in isolation and the domain model never leaks into the API contract (ADR-0004).
21. As a developer, I want aggregates reconstitutable from persisted state without re-triggering business rules, so that repositories can rehydrate them once persistence lands.
22. As a developer, I want every rule violation raised as a typed domain error, so that the application layer can map failures to package status and API responses without string-matching messages.

## Implementation Decisions

- **Two aggregate roots, not one.** Verification Package and Document are separate aggregates that reference each other by id only. Rationale: pipeline stages are atomic, retryable activities that operate per document or per page (ADR-0001); a single package-rooted aggregate would force every OCR write to load and save the entire package, serializing work that the PRD wants parallel. The consistency boundary that actually needs transactional protection is small: the package's lifecycle on one side, a single document's content on the other.
- **Verification Package aggregate** owns: its identity, the ordered list of member document ids, creation timestamp, the Package Status state machine, and — once completed — the Verification Report. Behavior: start processing, complete with a report, fail (with an optional human-readable reason surfaced to the Inspector). Invariants: at least one document id; no duplicate document ids; transitions limited to `Created → Processing`, `Processing → Completed`, `Processing → Failed`; `Completed` requires a report and both terminal states accept no further transitions.
- **Document aggregate** owns: its identity, the owning package id, original file name, file format (PDF/JPG/JPEG/PNG), its Pages, its Document Type, and its Extracted Fields. Behavior: add a page, record an OCR result against a page, assign the Document Type (exactly once), attach Extracted Fields (only after classification). Invariants: unique positive page numbers; OCR results only for existing pages; type assigned at most once; fields require a type.
- **Page** is a value object inside Document: page number plus a storage reference to the derived image (the object-storage key — the domain never touches bytes, ADR-0003), and, once OCR has run, the recognized text and OCR confidence. Recording OCR replaces the page value; the Document is the mutation surface.
- **Document Type** is a value object wrapping a profile-defined name, with `Unknown` as the only name the domain itself knows (ADR-0002). No enum of concrete types in the domain.
- **Extracted Field** is a value object: field name, string value, confidence in 0–1, page number.
- **Validation Issue** is a value object: an issue kind (missing document, mismatched fields, expired document, low confidence), a human-readable description, and optional document id / page number / field name references. The kind list is the domain's, since the report structure depends on it; the *rules that produce* issues belong to the future validation engine.
- **Verification Report** is a value object held by the completed package: verdict, detected documents (document id, type, extracted fields), and issues. Its factory derives-and-checks the verdict: any missing-document issue ⇒ Incomplete Package; otherwise any issue ⇒ Issues Found; otherwise OK. An inconsistent verdict/issues combination is unrepresentable.
- **Status and verdict vocabularies** are const-object string unions (`Created/Processing/Completed/Failed`; `OK/IssuesFound/IncompletePackage`), matching the statuses already agreed for the API design.
- **Construction pattern**: private constructors with a static `create` (runs invariants, for new objects) and, on aggregates, a static `reconstitute` (rehydrates persisted state for future repositories). No ORM types anywhere in the domain.
- **Errors**: an abstract `DomainError` base with one subclass per violated invariant, carrying the offending identifiers as constructor parameters.
- **No domain events for now.** `CqrsModule` is wired at the application shell, but the MVP pipeline is an in-process chain (ADR-0001); events can be added when a real consumer exists.
- **Explicitly not decided here**: the Verification Profile object shape and the validation engine — they are the next spec, and Validation Issue / Verification Report are designed to be their output types.

## Testing Decisions

- A good test exercises only the domain layer's public barrel export — the single agreed seam. Tests drive aggregates through public methods and assert on public getters and on thrown domain-error types. No test reaches into private state, no mocks or DI are involved (the domain has no dependencies), and no test asserts message strings.
- Modules under test: both aggregate roots (lifecycle machine, exactly-once classification, ordering rules), the Verification Report factory (verdict derivation), and the value-object guard clauses (confidence range, format whitelist, page uniqueness).
- Reconstitution is tested as external behavior: a reconstituted aggregate behaves identically to one built through its lifecycle.
- Prior art: none — these are the first tests in the repository and set the convention. Test runner: vitest (the workspace is ESM + TypeScript and has no runner yet; vitest handles both without transform configuration).

## Out of Scope

- The Verification Profile model and the validation engine that interprets it (ADR-0002) — next spec; this one only fixes their output types.
- Persistence: repositories, the ORM decision (Prisma is proposed but unconfirmed), and any schema/migration work.
- Application-layer use cases and pipeline stages, and any wiring of the domain into NestJS modules.
- API layer, `libs/contracts` zod schemas, and DTO mapping (ADR-0004 forbids domain types in contracts).
- PDF→page splitting mechanics and all port implementations (ADR-0003) — the domain only stores the resulting page image references.
- Domain events and Temporal migration concerns beyond keeping aggregates id-addressable.
- The web UI.

## Further Notes

- The aggregate-boundary decision (two roots, id-only references) should be recorded as ADR-0005 in `docs/adr/` during implementation, per the project rule of not deciding architecture silently.
- Glossary terms from `CONTEXT.md` are to be used verbatim in code identifiers (VerificationPackage, ValidationIssue — never Submission, Error, Flag).
- Stale build artifacts exist under `apps/core/build/` and `libs/contracts/build/` from earlier prototypes and do not reflect this spec; they predate the current glossary in part and should be regenerated after implementation.

## Comments
