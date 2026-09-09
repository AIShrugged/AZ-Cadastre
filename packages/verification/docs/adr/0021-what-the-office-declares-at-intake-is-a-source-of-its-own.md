# What the office declares at intake is a source of its own, and the profile is suggested from it

Date: 2026-09-09. Status: accepted.

Extends [ADR-0013](./0013-a-report-can-say-what-to-bring-next.md), whose branch
decides which supporting documents a case needs from two figures read off the
papers, and [ADR-0002](./0002-profile-driven-validation.md), which made the
Verification Profile the whole of what the engine judges by.

## Context

Two things the intake screen needs did not exist on the server.

**The office could say nothing about a case when it took it in.**
`CreatePackageRequest` took a profile key and a list of files, and nothing else.
The applicant states at the counter what their claim is founded on and roughly
when the house was built, and the system had nowhere to put either. So the
branch of ADR-0013 could only ever read the year off the papers — and where no
paper of the package states one, an office that knew the answer perfectly well
watched the report say the set could not be decided.

**The profile was picked by hand.** `profileKey` arrives from the operator with
no help of any kind. Today there is one profile and the choice is not a choice;
the moment there are two, an operator picking the wrong one files a case under a
policy that cannot verify it, and nothing tells them.

There was a third request — let the operator correct the values the engine read
— and the customer answered it directly: **the operator does not correct
readings yet.** That answer shapes this ADR as much as the two above it. The
report stays machine evidence with no places rewritten by a person, and nothing
here opens a door to editing one.

## Decision

1. **A declaration is a second source, stored apart from every reading.**
   `DeclaredAtIntake` holds two values — the ground the claimed right rests on,
   and the year the building is said to date from — as two columns on the
   package. They are not extracted fields and must never become any: an
   extracted field names the document, the sheet and how well it was read,
   because a reading can be a bad one. A declaration carries no confidence,
   because somebody typed it. `PackageDto.declared` publishes them in a field of
   their own for the same reason: a reader who could no longer tell a machine's
   reading from a person's statement is exactly what the customer's answer above
   rules out.

2. **Both figures are optional, and declaring nothing is the ordinary case.**
   Every package taken in before intake asked declares nothing, and a request
   that omits `declared` is the one this endpoint has always taken. Nothing is
   refused for want of a declaration.

3. **The branch falls back to the declared year, and only to the year.** Where
   no paper of the package states one, the branch of ADR-0013 uses what the
   office declared and the message says so — `dated 1998 as declared at intake`
   — because the whole worth of that line is that a reader can check it, and a
   figure nobody read off a sheet is checked at the counter rather than in the
   file. Where a paper does state one, the paper decides: a figure printed on a
   document is what the case rests on, and a declaration is what somebody said
   about it. There is no fallback for the height, because nothing is declared
   about it.

4. **Where both exist and differ, that is a finding of its own:
   `DeclaredValueMismatch`.** Not `FieldMismatch`, which is two papers of one
   submission disagreeing, and not `RegistryMismatch`, which is the papers
   against the record of what was registered. This is the papers against the
   counter, and it is the only one of the three where one side was typed by a
   person. It is **informational**: neither side is presumed right — a year is
   as easy to mistype at a counter as it is to misread off a scan — and the
   applicant did not write the declaration, so scoring their package down for it
   would hold them to somebody else's typing. It is filed against the reading it
   disagrees with, carrying that reading's confidence, so settling it means
   opening the sheet.

5. **A profile declares what it takes in, and the suggestion is decided on
   that.** `IntakeSpec` names the document types that can be the ground a right
   is claimed on, and the years the profile answers for. The cadastre profile
   names one ground — the order of the executive authority that allotted the
   parcel, the only paper in it that grants anything — and no year bounds: which
   supporting documents a case needs turns on the year (ADR-0013), but which
   policy governs it does not, and a threshold invented here would silently send
   submissions to the wrong profile. The grounds are published on `ProfileDto`,
   so the intake screen offers the operator the profile's own papers rather than
   a list of its own.

6. **`GET /profiles/suggestion` recommends and never decides.** It answers with
   a profile key or null, plus one reason per criterion — `legalBasis`,
   `builtYear` — stated whatever that criterion settled. `POST /packages` takes
   the operator's own choice whatever the suggestion said. The reasoning is part
   of the answer and not decoration: a recommendation nobody can argue with is
   one an operator can only obey or distrust.

7. **It proposes nothing where the declaration does not decide.** No ground
   declared, no profile registering it, or more than one registering it — all
   three answer with no profile and say which it was. It never falls back to the
   only profile there happens to be: an office that ships one profile today and
   two tomorrow must not find that a suggestion it had learned to trust silently
   changed meaning.

8. **A declared ground the chosen profile does not register is refused**
   (`LEGAL_BASIS_NOT_IN_PROFILE`, 422, naming the grounds it does register).
   Not a second-guessing of the operator's choice of profile — that choice
   stands, and the suggestion never narrows it. It is the two halves of one
   statement contradicting each other: a case founded on a paper this policy
   does not register is a case this policy cannot verify, and taking it in would
   file a submission nobody could act on and tell nobody. The check runs when a
   submission is taken in and never again: a profile that stops registering a
   ground must not make the packages already filed under it unreadable.

## Consequences

The intake screen has an API: `GET /profiles` says which grounds each profile
registers, `GET /profiles/suggestion` says which profile the declaration points
at and why, and `POST /packages` takes the declaration alongside the operator's
own choice. None of it is a rendering change on the server's side — the screen
itself is still to be built.

`PackageDto` gained a required `declared` field, so every response carries it,
and a package taken in before this says `{ legalBasis: null, builtYear: null }`
rather than being silent. `CreatePackageRequest` gained an optional one, so no
existing caller changes.

A report can now carry an eleventh kind of line. Like the observations before
it, it does not change `ReportStatus`, and a client counting findings has to
read `IssueKind.isInformational` rather than the number of lines — which is the
rule it already had.

**The one ground the cadastre profile names is ours and not the customer's**, in
the same way ADR-0013's thresholds are. It is one line of a declaration and it
is stated in the profile beside the papers, so whoever arrives with the real
answer changes that line and nothing else. What is not invented is the
mechanism: a case founded on a sale, an inheritance or a court decision is a
case this build has no profile for, and the suggestion says so instead of
proposing the only one it has.

**Nothing here lets an operator edit a reading**, and nothing here should be
extended into one. The customer's answer was "the operator does not correct
readings yet"; a declaration is what was said when the submission was taken in,
which is why it is written once, at submission, and never updated.
