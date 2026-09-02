# A stamp and a signature are what the profile expects of a paper, and their absence is a finding of its own

Date: 2026-09-02. Status: accepted.

Extends [ADR-0002](./0002-profile-driven-validation.md): a document type
declaration now says two more things about the paper, and the engine has a
seventh way to hold a package against the profile.

## Context

The transcription stage has always been asked to mark what is on a sheet and is
not text — `[stamp: <legend or "illegible">]`, `[signature]`, `[photo]`,
`[qr]`, `[barcode]` — and its prompt says in as many words that "whether a
sheet is signed and stamped is a finding of its own"
(`infrastructure/adapters/openrouter/ocr.adapter.ts`). Nothing acted on that.
The segmenter used the marks to tell where one document ends and the next
begins, the quotation check levelled them so that a value handwritten into a
sealed form is still quotable, and no rule ever asked whether the seal was
there.

An inspector asks it first. Of the seven papers of the `cadastre` profile, four
are issued by an office and are worth nothing without that office's marks on
them: an archival certificate that nobody sealed does not say which archive
says it, and an unsigned extract from a disposal order is a photocopy of a
claim. The system read those sheets, transcribed the absence faithfully, and
reported a clean package.

## Decision

**The profile declares it, per document type.** A `Declaration` now carries
`expectsStamp` and `expectsSignature`, both mandatory, so a type added later
answers the question instead of inheriting a default. Which type expects what is
policy and belongs where the rest of the policy is (ADR-0002); the engine only
reads it.

For the `cadastre` profile, the judgement — from §3 of
`docs/process-overview.md` and from what each of these papers is:

| Type                  | Stamp | Signature | Why                                                       |
| --------------------- | ----- | --------- | --------------------------------------------------------- |
| `land_plot_plan`      | yes   | yes       | drawn and issued by the cadastre office                   |
| `disposal_order`      | yes   | yes       | an act of an executive authority; an extract likewise     |
| `sketch_project`      | yes   | yes       | a design organisation seals and signs its own title block |
| `archive_certificate` | yes   | yes       | its whole worth is which archive states it                |
| `application`         | no    | yes       | written by a natural person, who has no seal              |
| `payment_receipt`     | no    | no        | printed at a bank counter or a terminal                   |
| `identity_card`       | no    | no        | its security features are printed into the card           |

The two "no, no" rows are the load-bearing ones. A rule that asked a seal of
every paper would report every correctly paid, correctly identified package as
faulty, and a check that fires on every package tells an inspector nothing.

**The engine reads the marks off the transcription and nowhere else.**
`attestationIn` lives in `domain/services/transcription-marks.service.ts`,
beside the rest of that vocabulary, so what the reader is asked to write and
what the report looks for cannot drift apart. It answers with the legend of
every stamp it found — a stamp the reader could not make out contributing an
empty legend — and whether a signature was marked. It is a domain rule: it
imports nothing, and the offline adapters and the model-backed ones are held
against the same one.

**The finding is `MissingAttestation`, and it is against the package.** A
tenth kind rather than a flavour of an existing one: `UnreadableDocument` is
about the reading — the sheet was read perfectly well — and `MissingDocument`
is about the envelope: the paper is here, and it is short of what makes it
valid. It is not informational, so a report holding one does not read OK; it
does not leave the package incomplete, because the document was supplied.

One finding per absent mark, not one per document, because an inspector
confirms a seal and a signature by looking at different parts of the sheet and
answers them one at a time. A seal that is there and says nothing is stated
apart from no seal at all: the question it raises is which office pressed it,
which is answered by opening the scan rather than by sending the paper back.

**It asserts nothing above the reading it came from.** The finding carries the
lowest confidence of the sheets the document covers, and a sheet that was never
read contributes an unassessed zero rather than the benefit of the doubt
(`docs/process-overview.md` §5). Where no sheet of the document was read at
all, no finding is filed: the sheets are already reported as unread, and
"this paper carries no seal" would then be a claim about the reading dressed up
as a claim about the document.

## Alternatives rejected

**A stamp and a signature as extracted fields.** They are not values: there is
nothing to compare across documents, nothing to hold against the register, and
a boolean in a field schema would be checked by the low-confidence rule as
though it were a date read off a form.

**Two issue kinds, `MissingStamp` and `MissingSignature`.** Every surface that
enumerates the kinds — the DB enum, the published contract, the inspector's
section list in three languages — would grow twice for one question, and the
inspector's action is the same for both: open the sheet.

**Requiring the marks of every type.** Rejected above: it would fire on every
package, and a check that never distinguishes anything is noise with a status
attached to it.

**Reading the marks per sheet rather than per document.** A multi-sheet order
is sealed on its last page. Looking sheet by sheet would report the first two
pages of every properly sealed order.

## Consequences

- A package whose papers came unsealed now reads `IssuesFound` where it used to
  read `OK`. That is the point, and it is the one behaviour change a reader of
  the register will notice.
- The offline OCR stand-in writes the marks its real counterpart is asked to
  write, so a mocked run of a good package stays clean and a mocked run
  exercises this rule the same way a live one does.
- The check is only as good as the transcription. A reader that sees a seal and
  does not mark it produces a false finding; the confidence carried on the
  finding is what says how much weight it deserves, and the inspector decides.
- Profiles beyond `cadastre` must state both fields for every type they
  declare. That is deliberate: the compiler asks the question.
