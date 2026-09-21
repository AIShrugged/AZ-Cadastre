# An operator enters a value, and the package is verified again from the stage the correction reaches

Date: 2026-09-21. Status: accepted.

Extends [ADR-0023](./0023-a-value-carries-its-origin.md), which gave a field an
origin and closed by saying that an operator entering a value was a door this
system had not opened. This opens it. Follows
[ADR-0013](./0013-a-package-takes-more-files-until-a-run-is-reading-it.md) for
what re-opening a package means, spends the approval
[ADR-0016](./0016-the-approval-of-an-archive-search-is-an-event-and-it-is-spent.md)
made an event, and reads the editor off the session
[ADR-0029](../../../docs/adr/0029-accounts-are-a-context-of-their-own-and-a-session-is-the-edges.md)
introduced.

## Context

The scans are poor. A reader gets a house number wrong, or gets nothing at all
off a line an operator can read with their own eyes from the paper in their
hand. Until now that was the end of it: the report said the field was doubtful
or missing, the operator could see what it should say, and there was nowhere to
put it.

The requester asked for the obvious thing — let the operator fix the field, save
it, and **make the checks that could change because of it again**: "точно —
кросс-документная сверка." Not a note beside a wrong value; the value itself,
with the consequences that follow from it.

Half of the mechanism already existed and had to be reused rather than rebuilt.
A file arriving at a package already does exactly this shape of thing: `takeIn`
discards the cross-checks, the registry checks and the report, spends the
archive-search approval, puts the package back to `Pending`, and the run that
follows re-reads nothing it has already read (ADR-0013). A correction is the
same event with a smaller blast radius.

Three things made it more than "discard and re-run":

**A corrected value has to answer for the paper, or the feature is theatre.** If
what an operator types is marked as something other than a reading of that
document, then by ADR-0023 it is not a side of a cross-document check, not what
the register is asked about, and not what a rule reads when it asks what the
paper states. The operator would be typing into a box that changes nothing.

**The extraction stage skips a document it has already read.** `hasFields` meant
"something was read off this document", and an operator's value satisfies that
literally. A document extraction never yielded anything for, whose one field a
person corrected, would then be skipped for good — one correction silently
cancelling the reading of every other field on that paper.

**And the machine must never write over a person.** The mirror of the same
trap: where the stage does run over a document that carries corrections, a
reading of a corrected key would put the reader's own answer back. A person
fixing a value and the machine undoing it on the next run is the one failure
that would make the whole feature worthless.

## Decision

1. **An operator's value is a fourth Field Origin, and `wasReadHere` is true for
   it.** `FieldOrigin.EnteredByOperator` joins the three of ADR-0023. A person
   read the paper, so the value may be a side of a Cross-document Check, may be
   what the register is asked about, and answers for the Document it hangs on.
   That is the whole point of it — an origin that answered `false` would be an
   origin nothing downstream could use.

2. **It is certain, and never a doubted reading.** The confidence is `1.0` and
   is set where the field is made rather than taken from a caller. A figure a
   person read off the sheet is not a reading with a probability attached, and a
   correction must never turn up among the report's `LowConfidence` findings,
   where it would send an inspector back to look again at the one value somebody
   has already looked at.

3. **It cites the sheet of the field it replaces, and none where it replaces
   nothing.** The same rule every origin that was read here follows: `foundOn`
   is a sheet of this document or it is absent, and there is no sheet to cite
   when nothing was read.

4. **The register's agreement leaves it alone.** `confirmedByRegistry()` does
   not turn an operator's field into `ConfirmedByRegistry`. The origin records
   where the value came from, and where it came from is a person; the register's
   agreement is already recorded on the registry check that asked. Overwriting
   the origin would lose the one fact an inspector most needs about that field —
   that it is not what the machine read.

5. **A correction carries who made it and when, and nothing else.**
   `editedByAccountId` is read off the session and never off the body, exactly
   as an owner is; it is a plain column with no foreign key, because the account
   row is in another context's database (ADR-0029). `editedAt` is the moment.
   Both are null on every field nobody has touched. There is no history beyond
   the last correction: the package holds one answer per field, as it holds one
   answer per check.

6. **One call carries every correction made to one document.** An operator fixes
   a form and saves it. A package that re-opened per keystroke would run the
   pipeline five times over one edit, and four of those runs would be reading a
   form the operator was still in the middle of.

7. **`null` is the operator stating that the paper does not say it.** The key is
   dropped from the document. A later run may carry a value over from a sister
   paper, which is correct and is the point of gathering (ADR-0023).

8. **An edit that changes nothing changes nothing.** A request whose every entry
   already holds that value as an operator's own is a no-op: no discard, no run,
   the package comes back untouched. An operator pressing save twice must not
   re-open a package that has been re-verified since the first press. The same
   text over a _machine_ reading is not a no-op — it is a person taking
   responsibility for the value, which makes it certain and puts it out of the
   extractor's reach.

9. **What a correction discards, it discards as one operation.** Every
   Cross-document Check and every Registry Check, because the edited value may
   be a side of any of them and working out which is a guess this system should
   not be making. The Verification Report, because it was compiled from them.
   The archive-search approval, spent, because it covered answers that no longer
   stand (ADR-0016). The Archive QR Check **of the edited document only**,
   because the question put to the archive is built out of that document's own
   fields and nothing on another paper changes it (ADR-0028). And every value
   carried over from the edited key of the edited document, wherever in the
   package it sits — a pointer at a reading that no longer exists is not a value
   the package states.

10. **What it keeps is what makes the re-run cheap.** Pages, recognised text,
    segmentation, classification, every other document's extracted fields and
    archive answer. The status goes back to `Pending` and a domain event starts
    the run — the same handler that answers a submission and an arrival, because
    the answer to all of them is the one answer: read this package.

11. **"Already extracted" counts machine readings, not operator entries.**
    `Document.hasMachineReadings` is what the extraction stage asks, and
    `hasFields` goes on meaning what ADR-0023 made it mean. A document whose
    only values a person typed has not been read by anything.

12. **A reading may never write over a correction.** `Document.withFields` keeps
    the operator's fields and takes the readings of every key they have not
    spoken for. The rule lives on the only way a reading can reach a document,
    rather than in the stage that calls it, so a second caller added later
    cannot get it wrong.

13. **Correcting is the office's own act.** `@RequiresRole('operator')`, and an
    applicant gets a **403** — the route and not the case is none of their
    business, which is the same reading the archive-search approval gets
    (ADR-0029). A paper a better scan has replaced is refused with
    `DOCUMENT_NOT_IN_FORCE`: nothing the package states is worked out from it,
    so the correction would change nothing an inspector reads, and the document
    that replaced it is the one to correct (COMM-80).

## Consequences

`FieldOrigin` has four members and the Prisma enum, `FieldOriginSchema` and the
**Field Origin** entry in `CONTEXT.md` all say four. A client that switched
exhaustively on three origins has a case to add; every field published before
this reads as it always did.

`FieldDto` gained `editedByAccountId` and `editedAt`, both nullable and both
null on everything the machine put there. The id and not a name: turning an
account into a person is a question for the context that owns accounts, and
nothing asks it today — what a screen shows beside a corrected value is the
date.

The repository now **deletes** field rows the aggregate no longer holds. Fields
had only ever been upserted, because nothing had ever dropped one; a struck-out
key and a carried-over value that lost its source both do, and a row left behind
would be served on the next read as a value the package does not state — and
would go on answering cross-checks.

**A correction is evidence and not an override.** The engine still publishes
only values somebody read off a paper of this submission, and every one of them
still says who read it. What changed is that "somebody" may now be the operator
holding the paper, and that saying so re-opens exactly the questions their
answer could change.
