# The register holds its records in its own database, and answers document by document

Date: 2026-08-27. Status: accepted.

Refines [ADR-0009](./0009-the-archive-register-behind-a-port.md) in two places
and supersedes none of it. That ADR put the archive register behind a published
contract and answered it with a stand-in reading a fixtures directory (§7); the
records are now rows in a database of the register's own, and the contract says
one more thing than it did. Everything else it decided stands: the register
still states facts and never a verdict, it is still an app and not a bounded
context, and the matching rules still live in `libs/matching-engine`.

## Context

Two things changed after ADR-0009 was written.

**The customer's own material arrived, and it is a schema catalogue.** Six
workbooks — `EMDK-FERİD`, `пасбаза 2`, `Hövsan s-s`, `TORPAQ KOMİTESİ`,
`QEYRI-YAS.-SBTİ`, `Qeyri-yaşayış və SBTİ tex pasportlar` — arrived stripped of
their rows and carrying, per sheet, the Azerbaijani column headers, an English
translation of each, a description and one example row. They are the "4 Excel
files" the customer's own AI use-case deck names, and that deck states the
barrier in one line: _the databases are not queryable via API in their current
state._ Beside them are two complete cases with their state register extracts,
their circulation sheets and their engineers' inspection reports.

What that material shows about the shape of the data is not what a JSON file per
property can hold:

- **The key of a property is `reyestr nömrəsi` and it is scoped to a territorial
  office.** The Hövsan handover registers put, on one row for one house, an
  Absheron office registration/register pair _and_ a Baku office pair, because
  the case moved between the two offices in 2008. A record keyed globally cannot
  hold both, and the second one is exactly what an inspector is looking for when
  the owner of record "changed".
- **A property always has more than one address.** The state register extract
  prints the URIS-assigned form and, in the same cell after `Köhnə ünvan:`, the
  one it carried before. The legacy registers hold a third and a fourth, some in
  the Azerbaijani legacy Cyrillic code page. A submission written against any of
  them is about the same property.
- **The archive records which papers a case has, paper by paper.** Ten sheets of
  `EMDK-FERİD` are per-settlement presence registers: a row is a case, a column
  is a kind of paper — `Ərizə`, `Texniki Pasport`, `Arayış`, `Sərəncam çıxarışı`,
  `Müayinə aktı` — and the cell is `+` or `-`. The column set differs from
  settlement to settlement.

**The archive lookup turned out to be load-bearing.** The `AI Verification
Points` sheet of the customer's checklist lists nine checks, and the sixth is
that for every document relied on under Decree 439, _the original must exist in
the National Archive Fund_ (§7). That is not enrichment beside a verdict. For a
whole class of titles it is the question.

Against that, what we had answered only "is there a record of this address, and
does it agree". A submission resting on a decree extract whose original the
archive never filed came back `Confirmed`.

## Decision

1. **The register keeps its records in PostgreSQL, in a database of its own.**
   `apps/registry-stub` grows a Prisma schema, a migration history and a seed
   under `src/infrastructure/persistence`, exactly as the verification context
   holds its own — and a _separate database_, `cadastre-registry`. `cadastre-db`
   belongs to verification, which owns it (RULE.md §3). The register is not a
   context; it is a different system that happens to run on the same server, and
   a join between a submission and the record of a registration must stay
   something the wiring cannot express.

2. **The schema is the spine the material shows, not one table of records.**
   `registry_objects` keyed on `(territorialOffice, registerNo)`;
   `registry_addresses`, one row per spelling with its kind; `registry_documents`,
   the presence registers normalised into rows because their columns differ per
   settlement; `registry_right_holders`; `archive_locations`; `registry_aliases`
   for the open set of other numbers one property answers to. Every number that
   is not arithmetic is text — folder, page range, storey count, area with its
   unit — because the sources hold `01-dən 30`, `2 (ики)` and `0,05 ha` in those
   columns.

3. **Every row records which register it came out of.** `sourceDatabase` on the
   object, the address, the document and the locator. There are six of these
   registers, they overlap, and where they disagree somebody has to be told
   which one said what. An answer without its provenance is not usable.

4. **The register answers what papers it holds, and the caller names both
   vocabularies.** `ArchiveRecordDto` grows `documents`; the lookup request
   carries `documents: [{ name, type }]` and the response one line per paper with
   `Held | NotHeld | Unknown`. `name` is the register's own word for the kind of
   paper — the only one it can look anything up by — and `type` is the caller's
   own document type, carried through untouched so a finding lands on a sheet the
   inspector can open. Neither side may borrow the other's name: the two
   vocabularies were written by different offices decades apart.

5. **Three states and not a boolean.** The presence registers write `+` and `-`,
   and the column set differs per settlement, so a kind of paper that area's
   register never recorded is `Unknown` — neither held nor missing. Collapsing it
   into `NotHeld` would report a column nobody ever kept as a paper nobody ever
   filed, which is the same mistake as reading an absent record as a fault.

6. **The profile declares which papers are asked about.** A `registryCheck` gains
   `documents: [[the register's word, document type key]]`. The `cadastre`
   profile names three — `Ərizə`, `Sərəncam çıxarışı`, `Arayış` — and
   deliberately not the receipt or the identity card: no presence register has a
   column for either, so asking would produce silence that reads as an answer.
   Only the papers a package actually carries are asked about; a required type
   the envelope is missing is already in the report as a missing document.

7. **A fifth outcome and a third registry issue kind.** `RegistryOutcome`
   gains `Incomplete` — the record agrees and the archive has no original of one
   of the papers — and the report gains `RegistryDocumentMissing`, one finding
   per paper. It is a finding and not an observation, unlike `RegistryUnconfirmed`:
   the archive wrote the absence down, and Decree 439 §7 makes the original a
   condition of the ground. `Differs` outranks `Incomplete` on the check itself
   when both are true; both sets of findings are reported.

8. **The address the register is asked about is a preference, not one field.**
   `registryCheck.subject` becomes an ordered list of `[document type, field]`,
   walked until a paper states one: for `cadastre`, the plan-scheme, then the
   sketch design, then the application. ADR-0009 said the lookup goes "against
   the first `application.property_address` read", and running the profile
   against the customer's two real submissions showed what that costs — in both,
   the application form's own address line went unread and a _second_ sheet
   classified as an application carried a mangled one (`Xetan uue, Burome 98.
5-862 saha`, `Can sok. Sabunçu rayonu, 1-ci qəbirzat qəsəbəsi`), so the
   register was asked about nothing and answered `NotFound` twice. The
   plan-scheme is the surveyed drawing of the parcel and its address was written
   by the office that surveyed it; the application is filled in by hand. Still
   one lookup per package — only which paper it is read off changed.

9. **The seed is the customer's two cases, and it is data rather than a file.**
   Every value in it is off a sheet of one of those cases, and the addresses are
   the ones the papers actually state — the parcel described by the road it lies
   beside, not only the URIS street the extract assigns after registration —
   because those are what the pipeline asks about.

   Rusadze Vera Vladimirovna (`005013055966-10301`, Zabrat) confirms on every
   attribute and every paper: the plan-scheme's `400.0 kv.m.` is the register's
   `0.04 ha`, the archive certificate's owner is the right holder of record, and
   the plan carries no cadastral number so the register is not asked for one.
   Əliyeva Rübabə Kavı qızı (`003013067339-10301`, Buzovna) is found, agrees on
   the owner, holds all three papers — and the plan-scheme surveys `0,0468 ha`
   where the record says `0.0309 ha`. That submission does not agree with itself
   either: the 1999 decree allotted `0,05 hektar` and the engineer's report
   states `500.0 m²` by the documents against `490.0 m²` measured. Any other
   address returns `NotFound`. Three further records keep behaviour the
   fixtures had: the property the all-`mock` pipeline reads off its own demo
   papers, a Hövsan handover pair so one address answers to two records, and one
   `пасбаза` row in the legacy Cyrillic code page.

## Alternatives rejected

**One database with two schemas.** Cheaper to run and it makes the wrong thing
possible: a schema-qualified join between `verification_packages` and
`registry_objects` compiles, runs, and is the first thing somebody writes when a
read model needs an owner's name. Two databases make it a network call, which is
what it actually is.

**Keeping the fixtures file and adding a database behind a second adapter.** Two
sources of truth for the same three cases, and the one that is wrong is whichever
was not edited last. ADR-0009 §7 already said the fixture adapter is replaced
when the records get somewhere real to live.

**A boolean `held` on the document.** Simplest, and it loses the distinction the
source data is built on. Half the settlements' registers have no column for half
the kinds of paper; a boolean makes every one of those look like a missing
original, which is a finding against a package for something the archive never
recorded either way.

**`RegistryUnconfirmed` for a missing original, rather than a new kind.** It
reads as "the register could not confirm this", which is the informational one —
told to the inspector and counted for nothing. A missing original is counted.
Reusing the kind would either make the absence of a record start counting or
make a missing original stop.

**A second bounded context, `packages/archive-registry`.** Still rejected, and
for the reason ADR-0009 gave: we hold six schema sheets and two cases, not the
data. A database inside the stand-in does not make the archive ours — the
register is a system outside this one whether its rows live in a file or in
PostgreSQL. When the 55 register files are actually ingested, that is the
decision to reopen.

## Consequences

- **The register now needs a database to start.** `pnpm dev` needs
  `cadastre-registry` to exist and its migrations applied; the API set spins a
  container, applies the history and runs the seed, which is most of what that
  set is now for. `docker compose` creates the second database through an init
  script that the postgres image runs **only on a new data directory** — on an
  existing volume it has to be created by hand, and the compose file says so.
- **The lookup reads the whole address table on every call.** The rule that
  decides whether two spellings mean one place is a JavaScript function and not a
  predicate PostgreSQL can be given, so the addresses are read and matched here.
  Fine for the cases the customer supplied and not fine for the 55 files:
  `TECH_DEBT.md` §9 says what fires and what to do.
- **A profile can now send the lookup to the wrong paper.** The ordering is a
  list of preferences and nothing validates that the papers on it are about the
  same property. The archive certificate was left off the `cadastre` list for
  exactly that reason: in the Rusadze submission it names `Bakı şəh.,
Ө.Əlizade küç., ev 13, m.13`, which is not the parcel being registered.
- **The record still names one owner.** `ArchiveRecordDto.ownerName` is the first
  right holder, and a property held in shares is a case the contract cannot state
  — the database holds all of them. Naming the largest share "the owner" would be
  the register having an opinion.
- **Two spellings the matching engine got wrong are now fixed, and there will be
  more.** Seeding a real `пасбаза` row showed that `ь` is `ğ` in that code page
  (`Таьыйев` is Tağıyev, `оьлу` is oğlu) and `ю` is `ö` — the same database heads
  a column `Паспорт нюмряси` and translates it, on the sheet beside it, as
  "Passport No.". Both are one spec each. The table is still incomplete: the same
  corpus carries Russian-transliterated surnames in the same column as
  Azerbaijani ones, and no table reads both.
- **A new finding kind reaches a client that has not been taught it.** As with
  ADR-0009: `IssueKind` is a published enum, and `apps/web` renders what it does
  not recognise as its raw key. It has been taught this one, in all three
  languages.
