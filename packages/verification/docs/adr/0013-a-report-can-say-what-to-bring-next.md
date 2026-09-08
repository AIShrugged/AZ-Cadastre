# A report can say what to bring next, and it says so on a table we invented

Date: 2026-09-08. Status: accepted.

Extends [ADR-0002](./0002-profile-driven-validation.md), which made the
Verification Profile the whole of what the engine judges by, and follows the
shape [ADR-0012](./0012-a-catalogue-of-documents-no-profile-asks-for.md) used
for the papers the profile has no opinion on. This one is about the papers that
are not in the envelope at all.

## Context

The customer asked for a branch: the supporting documents a first registration
needs are not the same for every building, and depend on how tall it is and what
year it is dated by. The request ended with the part that is easy to miss — even
where we cannot check, tell the applicant which set they must bring.

Two things stood in the way, and they are different problems.

**The profile could not branch.** A Verification Profile is a flat list: which
document types exist, which of them are required, which values must agree.
There is no "if the building is this tall, then these papers" anywhere in it,
and there never was.

**The report had no way to say it.** A `ValidationIssue` is a shortfall in the
package or a doubt about how well a sheet was read. What the applicant must
bring next is neither. Filing it as a finding would make a package that is
entirely in order report as one with a problem, and the difference between "we
checked and it is fine" and "we could not check" would disappear into the same
list.

**And we do not know the rules.** We asked the customer for the thresholds, the
years and the composition of each set. The answer was "do as you see fit". No
norm, no article, no circular. A threshold we invent and nobody notices is a
threshold that sends an applicant away for papers they do not need, or registers
a building on papers it needed and did not have. That is not a technical
mistake, and it must not be able to hide.

## Decision

1. **The mechanism is real; the numbers are a stub, and the stub says so.**
   The branch, the reading of the two figures, the choice of band and the
   message are ordinary code with tests on every path. The thresholds, the years
   and the sets are in one file — `domain/value-objects/supporting-documents.table.ts`
   — under a banner saying they are unconfirmed, listing what has to be learned
   before they are real. Replacing them is that file and nothing else: whoever
   arrives with the requirements changes rows, never logic.

2. **In code, not in a table in the database**, for the reason profiles are
   (ADR-0002). This is policy the engine interprets. Should the real rules turn
   out to change more often than a release goes out, that is the moment to
   revisit — and the moment to write it down here, not to quietly add a table.

3. **The profile declares the branch; the aggregate reads it.** A
   `SupportingDocumentsDeclaration` names where the height and the year are
   printed, in the order the papers are believed — the same ordering a registry
   check's subject uses (ADR-0010) — and the bands to read them into. Bounds are
   inclusive at the bottom and exclusive at the top, so the two bands either side
   of twelve metres can be written the way they are spoken.

4. **A figure that could not be read is null, and null never chooses a band.**
   A band whose rule turns on a measure nobody could read does not answer; one
   whose rule does not turn on it answers anyway. Guessing which side of a
   threshold an unread figure falls on is the one thing this must never do.

5. **A third kind of message: `SupportingDocumentsRequired`.** Not a shortfall
   in what arrived and not a doubt about the reading — a statement about what
   happens next. It is informational, so a report carrying nothing else still
   reads `OK`: absence of data is not a violation, and none of these papers was
   ever in the envelope to be judged.

6. **It is told whether or not the case could be placed, and the two do not read
   alike.** A message that placed the case names the band, quotes its bounds and
   is filed against the reading it was decided on, carrying that reading's
   confidence. One that could not names what could not be read and every set the
   applicant may be asked for, and carries no document, no sheet and no
   confidence. That absence is the marker: "we could not work this out" must
   never be mistaken for "we worked it out and all is well".

## Consequences

Every report under the cadastre profile now carries at least one message. A
package with nothing wrong with it is no longer an empty report — it is a report
whose only line is about what to bring — and `ReportStatus.OK` rather than the
number of lines is what says the package is in order. `VerificationReport.isClean`
means "holds nothing at all" and is not the same question.

The set of papers travels only in the English audit line. `IssueDto` carries no
list, so a client cannot yet render the papers in the reader's own language; the
web client shows that a set is required and whether the engine could work out
which. Publishing the sets — either on `ProfileDto` or as a field of the finding
— is the next step, and it is a contract change rather than a rendering one.

The sketch design gained a `building_height` field, because the branch has to
read the height off something. A package stored before it simply states no
height, and its report says the set could not be decided, which is true.

**Until the thresholds are confirmed, no decision may be made on this branch.**
It states what the engine believes; the engine's beliefs here are ours.
