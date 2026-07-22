# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary user: the Inspector** — a human official at the Real Estate Registration
Authority who reviews submitted document packages and makes the actual
registration decision. The system never approves or rejects anything itself.

Situation: the inspector receives multi-page, multi-format document packages
(PDF, JPG, JPEG, PNG) submitted for government registration, in Azerbaijani
(Latin and Cyrillic scripts). Their job is to verify each package quickly and
defensibly — confirming the right documents are present, the extracted data is
consistent across documents, nothing is expired, and low-confidence readings are
flagged — then make a legally accountable decision they can stand behind.

The inspector is not a data-entry clerk; the system does the reading and
cross-checking so the inspector spends their attention on judgment, not
transcription.

## Product Purpose

AZ-Cadastre is an AI-assisted document-verification system for government
registration workflows. It helps an inspector verify a submitted document
package by: collecting uploaded documents, recognizing each document's type,
extracting structured fields, checking completeness, cross-validating
consistency between documents, and producing a structured Verification Report.

**The system does not make legal decisions.** Its output is a report — the input
to a human decision, never the decision itself. Success is an inspector reaching
a correct, defensible verdict faster and with less manual cross-checking, with a
complete audit trail of what the system did and why.

## Positioning

The verification *mechanism* is domain-agnostic; the domain (cadastre, and
others later) is expressed as a declarative **Verification Profile** that the
engine interprets. A profile defines which Document Types exist, their field
schemas, which documents are required, and the cross-document rules. Adding a new
domain means adding a profile, not changing the engine.

This is the position a neighboring product cannot trivially copy: verification as
interpreted policy, not hardcoded rules — paired with a strict human-in-the-loop
stance (the system prepares evidence; the inspector decides) and an audit trail
built for accountability in a government setting.

## Operating Context

- **The unit of work is a Verification Package** — a set of files uploaded
  together for one verification.
- **Each uploaded file is exactly one logical Document.** Mixed-content files
  (e.g. a passport and a licence scanned into one PDF) are out of MVP scope.
- Every PDF is split into Pages (one image per page); an image file is one Page.
  Pages are the unit sent to OCR.
- The inspector's workflow surfaces (per PRD §6): a **Dashboard** of packages
  (ID, created-at, status, progress), an **Upload** page (upload files, create
  package, start verification), and **Verification Details** (uploaded documents
  → OCR result → extracted fields → validation report, where each issue links to
  its page, field, and confidence).
- In the MVP the inspector checks verification status by polling the REST API.
  Real-time push updates and notification channels are out of MVP scope.
- The verification pipeline is long-running and depends on unstable external
  services (OCR provider, classification model), which shapes the UX around
  progress, partial results, retries, and durable state.

## Capabilities and Constraints

**Confirmed capabilities (MVP scope):**
- Upload a package of one or more files; store originals in object storage,
  metadata in PostgreSQL; start the verification pipeline.
- Split PDFs into pages; OCR each page (recognized text, optional bounding boxes,
  confidence score).
- Classify each document (one type per document) against the active profile;
  demo profile types: Passport, Driver License, Application, Unknown.
- Extract structured fields per the document type's schema; each field stores
  value + confidence + page reference.
- Validate: required-document completeness, cross-document field consistency,
  expiration checks, and OCR-confidence thresholds (e.g. below threshold →
  "Needs review").
- Produce a Verification Report with overall status (OK / Issues Found /
  Incomplete Package), detected documents, extracted fields, validation issues,
  missing documents, mismatched values, confidences, and page references.

**Constraints / explicitly out of MVP scope:**
- No human-review workflows or notifications in the MVP.
- No real-time push (polling only) in the MVP.
- Multi-document files are out of scope (one file = one document).
- Orchestration: the MVP runs pipeline stages as an in-process pipeline inside
  the NestJS backend, shaped as Temporal-style activities so they can be lifted
  into Temporal later (ADR-0001). External capabilities (OCR, classification)
  sit behind ports (ADR-0003).

**Localization:** the inspector-facing UI is **multilingual — Russian, English,
and Azerbaijani (RU / EN / AZ)** — and must be locale-switchable. This is a
product constraint on every surface: labels, statuses, reports, and empty/error
states are all translatable, and layouts must tolerate the length and script
variation across the three languages (including Cyrillic). Document *content*
remains Azerbaijani (Latin and Cyrillic); the UI chrome is trilingual.

**Ubiquitous language (from docs/CONTEXT.md — use these terms, avoid the
alternatives):** Verification Package (not submission/case/batch); Document (not
file/scan/attachment); Page; Document Type (not category/kind); Extracted Field
(not attribute/property); Verification Profile (not ruleset/config/template);
Validation Issue (not error/violation/warning); Verification Report (not
result/summary); Inspector (not user/operator/reviewer).

## Brand Commitments

Visual identity is **greenfield** — no mandated authority logo, palette, or
government design system to honor. The one binding commitment is tone: this is a
**government MVP heading toward production** for real Real Estate Registration
Authority inspectors, so it must read as credible, precise, and accountable —
institutional software an inspector trusts to make a legally consequential
decision, not a consumer app. The name in use is **AZ-Cadastre**.

## Evidence on Hand

- Product documentation: `docs/PRD.md` (full MVP spec), `docs/CONTEXT.md`
  (ubiquitous language), `README.md`, and ADRs `docs/adr/0001`–`0004`.
- The MVP ships **one demo Verification Profile** exercising every rule kind
  (Passport, Driver License, Application, Unknown; required docs; cross-document
  equality rules; expiration; confidence threshold). This is illustrative demo
  data, not real cadastre document sets.
- No real production cadastre profiles, real inspector testimonials, usage
  metrics, benchmarks, or authority endorsements exist yet — future work must not
  fabricate them or imply a live government deployment that has not happened.
- Current `apps/web` is a Vite + React 19 + Tailwind v4 + shadcn scaffold
  (Geist variable font with Cyrillic subsets already installed); no real product
  UI has been built yet. There is no incumbent visual world to preserve.

## Product Principles

1. **The inspector decides; the system only prepares evidence.** Never phrase or
   style output as an approval, a verdict, or a recommendation to act — present
   findings, confidence, and provenance so a human can judge.
2. **Every finding is traceable.** An issue, field, or status always carries its
   page, field, and confidence. The interface earns trust by showing its work.
3. **Profiles are policy; the engine is neutral.** Design for a system where the
   rules are data that changes per domain, not fixed screens — surfaces should
   generalize beyond the demo profile.
4. **Built for accountability.** Long-running, auditable, resumable — the
   experience should make state, progress, and history legible, because the
   output backs a legally consequential decision.
5. **Trilingual by construction.** RU/EN/AZ is a first-class constraint, not an
   afterthought — nothing is designed that cannot be translated and re-laid-out
   across all three.

## Accessibility & Inclusion

No formal government accessibility standard has been confirmed as mandated for
this MVP. Because it is institutional software heading toward production use by
official inspectors, treat robust baseline accessibility (keyboard operability,
sufficient contrast, clear focus states, screen-reader-legible status and issue
information) as a default expectation, and confirm any specific required standard
before it becomes binding.
