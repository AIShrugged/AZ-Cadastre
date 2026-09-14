# The year is read off a paper, and the order allotting a parcel confers no right by its kind

Date: 2026-09-14. Status: accepted.

Supersedes [ADR-0025](./0025-the-required-set-is-the-provision-of-article-8-the-case-falls-under.md)
in two parts: decision 4, which dated a case by the year declared at intake
before any paper, and the filing, under decision 1, of the executive order
allotting a parcel as an Article 8.0.1 lease-or-use title. Amends
[ADR-0021](./0021-what-the-office-declares-at-intake-is-a-source-of-its-own.md):
the declared year is still kept and still told beside the papers, and it no
longer decides anything.

## Context

A pre-2013 house no taller than 12 m falls under one of two provisions, and the
right over the land decides which: lease or use is 8.0.9.1.1, which asks for an
approved design or an acceptance act besides the title; ownership is 8.0.9.1.2,
which asks for the title alone.

The right was read off the **kind** of title the package carries. The title in
both of the customer's real submissions is an order of an executive authority
allotting the parcel. The contract's list does not name it, so ADR-0025 filed it
as a lease-or-use title and called that an open question. It is the wrong guess
for both cases on the evidence we hold: both register extracts give the land as
ownership, while the order itself allots a homestead plot "for use". A paper
whose kind says one thing and whose register says another is not a paper whose
kind decides the right. The price of guessing is paid by the applicant: both
cases go to 8.0.9.1.1 and are asked for papers they do not need.

The year was what the office declared at intake, read before any paper. The
customer has said that for now the year comes from the papers — neither from the
operator nor from any other service.

## Decision

1. **The year is read off the papers alone.** In the table's order: the year of
   construction a technical passport states — the one line of a package that
   says when the house was built rather than when an act about it was signed —
   then the acceptance act, the permit for operation and the notification. The
   technical passport gains the field `built_year`. What the office declared
   dates nothing. It is kept on the package, and where a paper states another
   year the report still says so (`DeclaredValueMismatch`, informational).

2. **A case no paper dates is undecided on the year.** Every provision the year
   would decide stays a candidate and the report asks the inspector
   (`ProvisionUndetermined`), as for any figure nobody could state. A year is
   never taken from the counter to fill the gap.

3. **The order allotting a parcel confers no right by its kind.** It stays a
   title — it answers the requirement of Article 10.2.1 and is held to its
   window — and its entry in the table carries no right. Where it is the only
   title, the right is read off the wording of the register extract or the plan,
   the way it already is for a package that carries no title at all. Where
   nothing words it, the right is unstated and the provision undecided.

4. **A title dated outside every window its items give it decides no right.**
   It is still reported as `TitleDocumentInvalid`; it is no longer counted as
   the title the case stands on. A technical passport drawn up in 2026 is not a
   ground under item 2.4, and counting its kind would send an owned plot to
   lease or use on a paper that founds nothing.

5. **Offering a title.** Where the decided provision rests on one class of
   title, the operator is offered the titles of that class and every title
   whose kind confers none.

## Consequences

`TitleDocumentStandingDto.landRight` is nullable: a title whose kind confers no
right names none, and the provision panel says nothing about it.

The parameter source `DeclaredAtIntake` stays in the contract, and nothing
produces it any more. The intake still asks for the year: what it is now used
for is the finding that tells a disagreement.

Both real submissions — an order and an extract stating ownership — fall under
8.0.9.1.2 once the rest of their figures are read, and are asked for nothing
beyond the title. Neither carries a paper stating the year unless the technical
passport is in the envelope; without it they are `ProvisionUndetermined` on the
year, which is the honest answer until the imagery integration exists
(TECH_DEBT §11).

Stored reports are not rewritten. A re-run recompiles them.
