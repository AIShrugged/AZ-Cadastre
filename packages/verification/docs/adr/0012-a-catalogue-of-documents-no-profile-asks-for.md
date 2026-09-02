# A catalogue of documents no profile asks for

Date: 2026-09-02. Status: accepted.

Extends [ADR-0002](./0002-profile-driven-validation.md) and supersedes none of
it. That ADR made the profile the whole of what the engine judges by. This one
says what the engine may say about the papers the profile has no opinion on.

## Context

A document the classifier reads perfectly well and that is none of the profile's
seven types is classified `out_of_profile` and reported as the informational
`ExtraDocument`. The finding carries the sheets it sits on and nothing else:
what the document actually is was never recorded, so a package carrying six of
them puts six identical lines in front of the inspector, each saying only that
the profile does not ask for it.

The papers are not a surprise. `docs/process-overview.md` §4 step 4 names the
ones the inspectors actually see — the registrar's routing sheet, the
examination sheet, the designer's licence, a valuation contract, a courier
waybill, a covering letter — and the segmenter has been carrying its own
hand-written copy of that list since it started running service sheets together
into one shapeless block. The list exists. It was written down twice, in a
prompt, and never reached the report.

## Decision

1. **A catalogue, in code, of document types that no profile asks for.**
   `DocumentCatalogue.KNOWN` in `domain/value-objects/`, six entries, each a
   `DocumentTypeSpec` — the same shape a profile's own types have, because
   whoever classifies chooses between the two lists at once and cannot be shown
   them in two different shapes. Each entry declares no fields and is required
   of nothing, so nothing is extracted from it and nothing counts it missing.

2. **In code and not in a table**, for the reason profiles are (ADR-0002). This
   is policy the engine interprets, and a row an operator can edit would need a
   UI, a migration and a version before it bought anything the list does not
   already have. The list changes when a new kind of paper is observed in an
   envelope, which is a change somebody has to review either way.

3. **The catalogue names a document; it never places one.** A catalogued key is
   not the document's type. `Classification` keeps `out_of_profile` as its type
   and carries the catalogue entry beside it as `knownAs`, so `isPlaced` is
   false, no field schema is looked up and no requirement is answered. The name
   is the only thing that changes.

4. **A profile heading beats a catalogued one outright.** The offline
   classifier asks the profile first and the catalogue only when the profile
   has no answer; the model-backed one is shown the profile's types first and
   told plainly that the catalogue's are not what the profile asks for. Only
   the profile's own types answer a requirement, so a document that could be
   read as either is read as the profile's.

5. **`ExtraDocument` names the paper when it can, and reads exactly as before
   when it cannot.** Named, the finding carries the catalogue key as its
   `documentType` and says what was read; unnamed, it carries `out_of_profile`
   and the message it always had. It is still informational, still counts for
   nothing against the package, and is still not a category of its own — a
   catalogue that does not recognise a paper costs the report nothing.

6. **The name is persisted, because the report is compiled from storage.**
   `documents.knownAs`, nullable text, in the verification context's own
   database (`CONTEXT-MAP.md`). A key and not a name: the catalogue lives in
   code, so adding a paper to it never needs a migration, and a row written
   before the column existed reads as a document the catalogue had no name for
   — which is what it was.

7. **The segmenter's list is the catalogue's.** `ALSO_EXPECTED` in the
   OpenRouter segmenter is derived from `DocumentCatalogue.KNOWN` instead of
   being written out beside it. The stage that has to see these sheets apart and
   the stage that names them read from one place, so a paper added to the
   catalogue cannot end up known to only one of them.

## Alternatives rejected

**Making the catalogued types profile types with `required: false`.** They would
be `isKnown`, so they would be placed, carry a field schema and stop being extra
documents at all. The profile is the mandatory set; a paper the inspector may
ignore does not belong in it.

**A `known_documents` table in the verification database.** Editable without a
deploy, and that is the whole of what it buys: six rows nobody has asked to
change, plus a migration, a read on every classification, and a second place
that can disagree with the profile about what a key means.

**A free-text name from the model instead of a fixed list.** The report would
carry whatever the model wrote that run — "kuryer qaiməsi" one time and "courier
waybill" the next — so nothing could be counted, translated or matched. A key
off a list is what a reader can render in the inspector's own language.

**A new `IssueKind` for a named extra document.** It would split one
informational finding into two that mean the same thing, and every reader —
report status, the web app's sections, the register's tallies — would have to
learn the second one to keep saying what it already says.

## Consequences

- **The offline classifier now answers `out_of_profile` where it used to answer
  `unknown`.** A courier waybill with no profile heading on it was previously an
  unplaced document and reported as unreadable; it is now an extra document with
  a name. That is a better answer and it is a changed one: a mock-provider run
  over a package holding service sheets reports fewer `UnreadableDocument`
  findings than it did.
- **The catalogue is deliberately short.** It is what the customer's envelopes
  have been seen to carry, not a guess at everything that could turn up. A paper
  it does not know is still reported, as the extra document it has always been —
  which is the property that lets the list grow one observed document at a time.
- **`IssueDto.documentType` may now hold a key that no profile declares.** A
  reader that renders a finding by looking its type up in the profile finds
  nothing for these; the key is what it renders by, the same way it renders
  `out_of_profile` today.
