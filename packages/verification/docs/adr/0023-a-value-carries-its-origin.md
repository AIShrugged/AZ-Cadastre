# A value carries its origin, and one a paper did not yield may be closed from the package

Date: 2026-09-10. Status: accepted.

Extends [ADR-0002](./0002-profile-driven-validation.md), whose profile already
declares which papers print the same value, and
[ADR-0009](../../../docs/adr/0009-the-archive-register-behind-a-port.md), whose
register answers with facts the profile turns into meaning.

## Context

The customer asked for three things about reading a field: read it off the paper
with a model; where that fails, look in the accompanying documents — **and mark
what is found that way as found indirectly**; and where a third-party
integration exists, check the value against it.

Only the first was built. The second and third were visible to an inspector as
holes.

**The answer was in the envelope and the screen showed a blank.** The profile
says the address of the property is printed on five of its papers. Extraction
runs per document: it is handed that document's sheets and its type's schema,
and it never sees the package. So a sketch design whose address line went unread
left the field absent — while the same address stood legibly on the plan-scheme,
had been read, and was sitting in the same package. The inspector was shown
nothing where the system had an answer.

**The register's agreement lived two screens away from the value it agreed
with.** The archive register is asked about three attributes of the property —
the owner of record, the cadastral number, the surveyed area — and each of them
is a field somebody read off a paper. The answer was recorded on the check. An
inspector reading the field had no way to see that a source outside the envelope
holds the same thing.

**And a field had no way to say where its value came from.** `ExtractedField`
held a key, a value, a confidence and the sheet it was found on. There was one
possible origin and it was implicit, which is exactly why closing a field from
elsewhere without saying so would have been worse than leaving it empty: it
would have passed a guess off as a reading.

## Decision

1. **Origin is part of the field, and it is an origin and not a flag.**
   `FieldOrigin` has three members — `ReadOnThisDocument`,
   `TakenFromAnotherDocument`, `ConfirmedByRegistry` — because the three are not
   degrees of one thing. A reading is evidence about _this_ paper, a value
   carried over is evidence about the _package_, and a confirmation is evidence
   from _outside_ it. A boolean called `implicit` would show one badge for two
   facts an inspector acts on differently.

2. **A carried-over value cites no sheet of the document it hangs on, and its
   source keeps its own.** `pageNumber` is nullable and is null exactly on
   `TakenFromAnotherDocument`; the source document, its type, its field and the
   sheet **of that document** ride in `takenFrom`. Null and not the source's
   number: a client turns `pageNumber` into a page of the document the field
   hangs on, and a foreign number there would send an inspector to the wrong
   paper — worse than sending them nowhere.

3. **A carried-over value is the source's reading, discounted.** It can never be
   surer than the reading it was copied from, and it is deliberately a little
   less sure: the package being consistent about a value is not this paper
   stating it. The factor lives in `ExtractedField` with the reasoning beside it
   and is set clear of `Confidence.FLOOR` — a factor small enough to push a
   perfectly read source under the floor would make "is this doubted" turn on a
   constant rather than on how the paper was read.

4. **The map of "the same value" is the profile's cross-checks and nothing
   else.** They already name which `[document type, field]` pairs print one
   value and already say what agreeing means. A second list beside the first is
   how the two come to disagree. A check in which one document type names more
   than one field is not such a map and carries nothing:
   `applicant_identity` holds the surname _and_ the given name on the identity
   card against the one full name on the application, and moving the full name
   into the surname field would invent a reading out of a rule that never said
   the two were equal. `CrossCheckSpec.isOneValueAcrossPapers` reads that off the
   declaration, so a profile that adds a composite check gets the right answer
   without anybody remembering a second list.

5. **Nothing is chosen between.** A value is carried only where the papers that
   state it speak with one voice: the cross-check's own verdict decides it
   wherever one was made, and where none was — a check needs two documents —
   every candidate must read alike by the engine's own rule. Where they do not,
   the field stays empty. That case is `FieldMismatch`, the report already says
   it, and replacing a disagreement with a guess would make the report read
   better than the package is. Which source, where there are several, is the
   surest reading, and at equal confidence the order the profile names the
   papers in — that order is already an ordering by trust.

6. **A carried-over value answers for nothing.** It is not one of the sides a
   cross-check weighs, it is not what the register is asked about, and it is not
   a paper the archive is asked whether it holds. `valuesOf` reads only what was
   read off a document, so every rule that asks what a paper states gets the
   same answer it did before. The stage also runs _after_ the cross-checks and
   the register, so the guarantee is structural as well as filtered.

7. **No `LowConfidence` finding is filed against a carried-over value.** That
   finding says a reading was doubtful and sends the inspector to the sheet it
   was made on. There is one reading here — the source's — and it is already
   reported against the document it was made on. A second copy would put the
   inspector in front of a paper with nothing on it to look at, under the same
   heading as the papers where there is something. The origin on the field is
   what tells them it was not read here.

8. **Registry agreement lands on the field; disagreement does not.** Where an
   attribute the register was asked about agrees with the record, the reading it
   came from is marked `ConfirmedByRegistry` — value, confidence and sheet
   untouched, because the register agreed with the paper, it did not read it
   better. A record that says something else is `RegistryMismatch` and silence
   is a column that area never kept; neither needs a second way of being said,
   and a field marked "differs" would put one finding in the report twice under
   two names.

9. **No integration is stubbed to make this look wider than it is.** The
   customer's acceptance contract names MQS, Google Earth, the licence portal,
   the town-planning committee and the national archive, and marks them as
   required. None of them exists here, and a stub standing in for one would read
   in the report as a checked fact. The one live integration is the archive
   register, and that is the one this uses.

## Consequences

The pipeline has eight stages instead of six: `confirm` lays the register's
agreement onto the readings, and `gather` closes what a paper did not yield out
of the package. Both are wrapped in the same `despite` as every other stage — a
failure costs the stage, not the run.

`FieldDto` gained `origin` and `takenFrom`, and `pageNumber` became nullable.
That is a breaking change for a client that treated the page as always present;
no client in this repository did. A field published before this exists reads
`ReadOnThisDocument`, which is what it always was.

`Document.hasFields` now means "something was read off this document", not
"something hangs on it". Without that, a document whose only values were carried
in would tell the extraction stage it had been read, and a re-run would skip the
one paper it most needed to open.

**The engine still never invents a value.** Everything it publishes was read off
some paper of the submission, and now says which one. What changed is that a
value the package holds is no longer hidden from the inspector by the accident
of which sheet it was printed on.

**Nothing here is an operator entering a value.** The customer's contract also
names values "entered by the operator" for what is in neither the documents nor
the integrations; that is a screen and not an engine, and no origin here opens a
door to one.
