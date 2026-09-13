# The required set is the provision of Article 8 the case falls under

Date: 2026-09-13. Status: accepted.

Supersedes [ADR-0013](./0013-a-report-can-say-what-to-bring-next.md) in the part
that stated the supporting documents a case needs off a table we invented, and
amends [ADR-0021](./0021-what-the-office-declares-at-intake-is-a-source-of-its-own.md)
(the declared year is now read first for one figure) and
[ADR-0022](./0022-the-catalogue-is-the-statutory-list-of-grounds.md) (twenty-one
of its keys move into the profile). Builds on
[ADR-0002](./0002-profile-driven-validation.md): the policy is still a
declaration the engine interprets.

## Context

The profile said a package was complete when it carried seven papers. The
customer's own acceptance contract — the "reference implementation" of document
compliance verification, version 1.2 — says something different, and says it as
data: a decision table, the documents each provision requires, the date windows
of every title document, the fields read off every paper and where each paper
comes from.

In that contract a first registration of an individual residential house is
decided on six figures: when the house was built, its storeys above ground, its
height, its longest span, the right held over the land and what the land is
designated for. The figures select a provision of Article 8 — 8.0.9.1.1,
8.0.9.1.2, 8.0.9.2, 8.0.10.2 or 8.0.10.1 — and the provision selects the papers.
A pre-2013 house on owned land needs its title and nothing else; a house built
since 2013 under the notification procedure needs the architectural and planning
section and the notification; a taller one needs a permit and the permit for
operation. Every provision needs a title to the land, and a title is any of
fifteen papers, each valid only within a window of dates.

Three things in the system stood in the way.

**The required set was flat.** `requiredTypes` was one list, stated up front,
and a report could say a type was missing and nothing else.

**The papers a provision asks for were not read.** Most of them were in the
statutory catalogue (ADR-0022), which names a paper and extracts nothing from it,
and which by design never answers a requirement.

**The branch that did exist was ours.** The supporting-documents table of
ADR-0013 turned on height and a year with thresholds nobody confirmed
(TECH_DEBT §11). The contract now supplies the real ones.

## Decision

1. **The table is data, transcribed, and it is the customer's.** The rules,
   the requirements and the title documents live in
   `domain/value-objects/article-8-provisions.table.ts`, taken from the
   contract's `RULES`, `REQUIREMENTS` and `GROUND_ITEMS`. The mechanism —
   `ProvisionsSpec` in `provision.vo.ts` — reads it. Where the table departs
   from the contract, the row says why: item 8.0.12 for property certificates
   issued in 2006–2009, which the statutory catalogue already named, and the
   executive order allotting the parcel filed as an 8.0.1 lease-or-use title,
   which the contract does not list under that name and both real submissions
   rest on.

2. **The table is read first-hit, and an unread figure is never a guess.** A
   row a figure rules out is skipped. A row that turns on a figure nobody could
   state stays a candidate, and so does every open row after it up to the first
   that holds. One candidate that holds is `Determined`; several are
   `Ambiguous`, with the figures whose reading would settle it; none is
   `Undetermined`. The contract's twenty-three cases are the unit tests.

3. **Where each figure comes from is declared, in the order the papers are
   believed.** Storeys, height and span off the design; the purpose of the land
   off the register extract, then the plan; the right over the land off the
   **kind** of title the package carries ("ownership: extract, state act, 8.0.5
   documents; lease or use: the remaining documents"), and only without one off
   the words of a plan. The first reading that exists decides even when it
   cannot be understood, and what was refused is published beside the null — a
   fall-through would decide the case on a paper the profile believes less,
   without anybody being told.

4. **The year is what the office declared, and only without a declaration a
   paper.** The contract takes the date of construction from satellite imagery
   confirmed by the operator; no paper of the package states when a house was
   built. Until that integration exists the operator's word is the nearest thing
   to the source it names. The papers that close a construction — the
   acceptance act, the permit for operation, the notification — are read where
   nothing was declared, and where both exist and disagree the report says so
   (ADR-0021's finding, now read off those papers). A design's approval date is
   never read as the year.

5. **The provision is worked out on every read and never stored.** A pure
   service, `provisionOf`, over the same flat readings the gaps use (COMM-80):
   the aggregate compiles the report on it, the gaps the supply operation
   accepts depend on it, and the detail view publishes it as
   `PackageDetailDto.provision`. One answer, three readers, no row that can
   disagree with the readings it was drawn from (ADR-0014).

6. **Required of every package: the plan of the plot and the sketch design**
   (Articles 10.2.2, 10.2.3). The title (10.2.1) is required of every package
   too, but as any of the titles, and reported as `MissingTitleDocument`. The
   application, the identity card, the receipt, the archival certificate and
   the disposal order are required of nobody: none of them is among the papers
   the contract asks for — the identity is taken from IAMAS through MQS and the
   duty is paid once the application is approved. They are still classified,
   read and cross-checked where they arrive.

7. **A provision's own papers are asked for only once it is decided.** A
   decided provision's unanswered group is a `MissingDocument` — naming the type
   where the group has one, and none where any of several answers it, because
   naming the first would send the applicant for that one. An undecided
   provision is `ProvisionUndetermined`, held against the package: which papers
   are owed is exactly what is unknown, and only the inspector can settle it.
   Listing every candidate's papers as missing would ask for papers no provision
   of the case needs.

8. **A title dated outside every window its items give it is
   `TitleDocumentInvalid`,** filed against the date it was read off. The class
   of a title is not separately checked against the provision: the right over
   the land is read off the class of the title, so a decided provision always
   rests on a title of the class it takes, and two titles of different classes
   leave the right — and the provision — undecided.

9. **Every paper declares where it comes from.** `Package`, `Mqs`,
   `LicencesPortal`, `UrbanPlanningCommittee` or `NationalArchive`, from the
   contract's field table. None of the four systems is connected, and no stub
   pretends to be: a paper whose source is a system is reported as
   `IntegrationNotConnected` — informational, never against the package — so a
   paper that was only read never reads as one that was confirmed. The same
   finding is filed without a document where the policy takes a fact from a
   system instead of from the envelope: the notification of a house built from 2026.

10. **The papers a provision reads are the profile's own types.** Twenty-one
    keys move out of the catalogue into the profile with their descriptions and
    headings, and gain the fields the contract asks of them. `approved_design`
    is new. The catalogue keeps what no provision reads, and a key is in one
    list or the other.

11. **The archive is asked about the originals of the titles its registers
    keep,** under the registers' own words — the Land Committee's state acts,
    the technical inventory's passports, the State Property Committee's
    certificates and contracts. A title is looked for in the section its kind
    belongs to; which section holds which kind is the customer's to confirm.

## Consequences

The supporting-documents mechanism is removed, table and code. Reports written
before this carry `SupportingDocumentsRequired`, so the kind stays in the enum,
the database and the contract, and is no longer compiled.

A package that was complete under the seven-paper list is not complete now
unless it carries a title and whatever its provision asks for; a package that
was incomplete for want of a receipt is not. Stored reports are not rewritten:
they describe the package as it was verified then, and a re-run recompiles
them.

Every report on a package carrying a plan of the plot now holds an
`IntegrationNotConnected` line, because the plan is a paper the policy confirms
through MQS. That is the intended cost of never letting "read" pass for
"confirmed".

The intake declares a year and not a date, so the notification boundary of June
2025 is read as the year 2025 on the letter's side. The contract's own date
boundaries for the provisions (31.12.2012 / 01.01.2013) coincide with a year and
lose nothing.

What this does not do, and why:

- **MQS, the Licences Portal, the Urban Planning Committee and the National
  Archive's QR check** need access nobody has given. Each is a port away; until
  then the report says what was not checked.
- **"Prior applications that cited this document"** has no source: the register
  holds records of property, not of applications.
- **Taking a title's fields from the archive when the package carries none**
  would need a fourth field origin and a rule for when a record stands in for a
  paper; the customer has not said whether it ever does.
- **The date of construction from satellite imagery** is an integration.
