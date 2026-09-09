# A register row names the case, and the profile decides how

Date: 2026-09-09. Status: accepted.

## Context

`GET /api/packages` answered with the technical side of a submission and
nothing else: an id, a profile key, the counts of files and documents, what the
run found, two timestamps. The screen the customer's mock-up asks for has a
column for the applicant and a column for what the archive said, and neither
could be filled — so the list led its rows with a uuid and the word "cadastre",
which is not what anybody in the office calls a case.

Everything the two columns need is already in the system, and only on the
detail view: the applicant, the address and the cadastral number are extracted
fields on `documents[].fields[]`, and the archive's answer is
`registryChecks[].outcome`. An inspector could see all of it — after opening
the submission they were trying to find.

## Decision

### The row carries what the case is called, and it is read, never stored

`PackageDto` gains `applicantName`, `propertyAddress` and `cadastralNumber` —
each a `StatedValueDto` of `{ value, confidence }`, or `null` — and
`archiveOutcome` (`RegistryOutcome | null`) beside `archiveSearchApproved`.

Nothing is denormalised and nothing is recomputed in the background. This is
the same principle the standing lives by (ADR-0014) and the summary of a period
lives by (ADR-0017): the values are already stored once, as extracted fields
and as registry checks, and a second copy on the package row is a copy that
falls out of step the first time a file is added and the package is verified
afresh (ADR-0013).

The cost is what the read side loads. `SUMMARY_COLUMNS` gains two nested
selects — the register checks' `outcome` alone, and the extracted fields
narrowed to the keys some profile names a case by. Prisma answers a nested
select with one statement per relation over the whole page, so a page of a
hundred rows (`LIST_PACKAGES_MAX_LIMIT`) costs three statements and not three
hundred. If it ever stops being enough the answer is a better statement, not a
column somebody has to keep true.

`confidence` travels with each value because the reading is a reading: a name
the pipeline was 40% sure of is not the same thing on a screen as one it was
sure of, and a row that showed only the string would be asserting what the
system only guessed. What a client draws with it — a band, a shade, a warning —
is the client's business and is not in this change.

Value and confidence and nothing else. Which sheet a value was read off, and
what the run made of it, stay on the detail view: a row names the case, the
card evidences it, and putting the provenance on both would be two answers to
one question.

### Which field of which document type is the profile's to say

An address is printed on five of this profile's papers and they are not equally
trustworthy. A list screen picking one for itself would be a second source of
truth for what a submission is, and the first row it disagreed with the package
on would be a row nobody could explain.

So the Verification Profile declares it. `ParticularsSpec` holds three ordered
lists of `[document type, field]`, read exactly the way a registry check's
subject is read (ADR-0010): the first of them the package actually states is
the one the row carries. Nothing is composed and nothing is joined — the value
is one field as the pipeline read it, or there is none. That is why the
identity card is not among the papers the applicant is named off: it prints a
surname and a given name in fields of their own, and a name assembled out of
two readings is a value no document states.

The address ordering is the register's own — the plan-scheme first, the
application last — with the disposal order and the archive certificate in
between. A spec holds that: restricted to the papers `property_of_record` is
asked about, the row's ordering is the register's ordering. So wherever both
have an address, the row and the archive answer are about the same one, and a
reader can hold them side by side.

`null` is the answer where no document of the package states the value yet —
never an empty string, which a reader takes for a value somebody left blank. A
package under a profile this build no longer ships is named by nothing rather
than failing: the register is a read surface, and one stored key nobody
recognises must not take a whole page down.

### One archive answer for a row, in the order of what it asks

A profile may put more than one question to the register; a row has one word.
`RegistryOutcome.overall` decides which: a record that contradicts the package,
then a file the archive is short a paper of — the two that are findings against
the submission — then a property more than one record answers to, then no
record at all, and `Confirmed` last, so it is the answer only when it is every
answer.

`null` is a question nobody put. It is deliberately not `NotFound`, which is a
question the archive answered with silence: a row that said the same word for
both would be announcing an answer nobody has (ADR-0009).

## Consequences

`PackageDto` grows five members, so `PackageDetailDto` does too — additive on
the wire, and a client that ignores them is unaffected. `apps/web` draws the
new columns in a change of its own.

The profile now says something it did not: what a case of its kind is called.
A profile that declares no particulars answers `ParticularsSpec.none()` and
every submission under it is known by its id, which is what the list can then
say — the register never has to ask whether a profile has an opinion.

No migration. Every value the row now carries was already stored, on
`extracted_fields` and `registry_checks`.
