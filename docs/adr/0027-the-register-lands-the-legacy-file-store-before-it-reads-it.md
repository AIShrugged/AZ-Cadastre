# The register lands the legacy file store before it reads it

Date: 2026-09-16. Status: accepted.

Extends [ADR-0010](./0010-the-register-holds-its-records-in-its-own-database.md)
and [ADR-0012](./0012-the-register-reads-the-archives-own-workbooks.md) and
supersedes neither. ADR-0010 gave the register a database shaped like the six
schema sheets the customer sent; ADR-0012 taught it to read those six workbooks
off an upload. This one shapes the database for what is actually behind them —
the archive's file store — and for the way it is going to arrive.

## Context

**The inventory of the legacy file store arrived.** `csv-files/` is five
semicolon-separated listings made by walking the archive's shares: every file
(`files.csv`, 1 848 rows), every sheet of every workbook with its used range and
header row (`sheets.csv`, 290), every column header (`headers.csv`, 1 971),
every dBase/FoxPro table with its version, record count, deletion count and code
page (`dbf.csv`, 235), and every field of those tables (`dbf_fields.csv`,
2 655). No records — the shape of all of it.

What it shows:

- **Most of the store is not data.** `ARXIV/UDH3/Vfp98` is a Visual FoxPro 98
  installation: 167 of the 235 tables are its wizard templates and samples.
  Around the data sit the programs that kept it (`.exe`, `.app`, `.prg`,
  `.scx`, `.frx`), memo and index companions (`.fpt`, `.dbt`, `.cdx`, `.mdx`),
  ten Excel lock files, shortcuts, and two `.xlsx` under a password.
- **The data is three families, not six files.**
  - _Workbooks_ — some fifty once lock files and the two under a password are
    set aside, 219 sheets with a header. Privatisation
    certificate registers (`Ozallasma-abş-reg- yeni.xls`, 38 sheets); settlement
    presence registers (`Ərizə | Tex. Pasp. | … | İnven. N-si | Qeyd N-si`)
    copied across `Təhvil Abşeron/`; the individual-house inventories of
    `Fərdi yaş və qarajlar/`, one workbook per settlement
    (`Opis | Adı soy adı | Qəsəbə | Ünvan | ev №`); the non-residential lists of
    `Qeyri yaşayışlar(MP)/`; apartment buildings by housing office
    (`Küçə adı | Ev № | JEK №`); garden associations (`BAğ-HESABAT`,
    `YOLDASHLIQ SIYAHISI`, and `order.xlsx` — 219 429 plot orders on one sheet);
    the registration lists of `Qeydiyyat/`.
  - _The inventory application `ARXIV/INVEN/inv`_ — `mulk.DBF`, 357 739
    records over 34 fields keyed on the case number `NOMKV` (book and page,
    district, date, type, value, order, decree, name, address, areas, and a
    third of fields nobody has explained: `NAZAR`, `OZAL`, `TEX1`, `DTIK`);
    `tarix.DBF`, 419 637 entries on the same key with a name, dates and a ground
    each; `FIOARXIV.DBF` and `ARXIV.DBF` (a memo per case); small dictionaries
    (`RAYON`, `NOV`, `MULKN`, `ADRES`). `mulk.BAK` and `ulk.DBF` are copies.
  - _The dacha register `ARXIV/UDH3/UDH3`_ — `ident3.dbf`, 38 584 plots with
    the name in three fields, the massif, the contract, the decision and two
    areas; `buh.dbf`, their payments; the massif and district dictionaries. The
    `none/` directory is a 2007 copy of the same tree.
- **Copies are everywhere and are not byte-identical.**
  `Qeydiyyat/Şəhadətnamələrin siyahısı.xlsx` is `Ozallasma-abş-reg- yeni.xls`
  saved again with columns added to one sheet; the presence registers appear
  under three names each.
- **Two tables hold passwords.** `FIO.DBF` (`DIREK`, `PAROL`) and `user.dbf`
  (`USER`, `PASSW`).
- **Declared code pages are not to be trusted.** `mulk.DBF` declares 1252 and
  holds Azerbaijani names and addresses; the workbooks beside it include the
  Azerbaijani Cyrillic code page ADR-0010 already met.

**And it will arrive as events.** The files are to be put into a RustFS bucket,
the bucket notifies the register over S3 event notifications, and a worker
processes them. A notification is delivered at least once and in no promised
order, and a single table here takes minutes to read.

Against that the database held only the canonical spine: an object, its
addresses, holders, papers, numbers and one locator, each stamped with a
`sourceDatabase` string. Nothing could say which file a fact came from, whether
a file had been read, or why a file produced nothing — and every change to the
lexicon meant uploading the file again.

## Decision

1. **Two layers, and the canonical one is derived.** A _landing_ layer holds the
   file store as it is — `legacy_files`, `legacy_tables`, `legacy_columns`,
   `legacy_rows` — and the existing spine is what mapping those rows produces.
   A lexicon or catalogue that learns something is a re-mapping of rows the
   register already holds, found through `legacy_tables.mappingVersion`, not a
   hunt for a file.

2. **The bucket's notifications are an inbox, `storage_events`.** Written before
   anything is done, deduplicated on `(bucket, objectKey, sequencer)` so a second
   delivery is an insert that does nothing, ordered per key by the S3
   `sequencer` so a late DELETE is recognisable, and claimed by the worker with
   `status`, `attempts` and `lockedUntil`. The webhook answers once the row is
   written; the reading happens outside the request.

3. **Every file is recorded, including the ones that are not read.** A skipped
   file carries its `skipReason` — `Program`, `Companion`, `Temporary`,
   `Shortcut`, `Encrypted`, `Duplicate`, `Credentials`, `Unsupported`, each a
   kind the inventory actually contains — so "did you get this file" is a query
   and not an inference from missing records. A memo or index file points at
   its table through `companionOf`; a byte-identical copy at its original
   through `duplicateOf` and `sha256`.

4. **A sheet and a table are one model, and it is the unit of work.**
   `legacy_tables` carries what each format says — visibility, header row and
   used range for a sheet; version, declared code page, deletion count, memo,
   index and size check for a table — and a status of its own, because a
   38-sheet workbook that fails on one sheet has landed the other 37. The code
   page is recorded twice, declared (`codePage`) and used (`codePageUsed`).
   `headerSignature` groups tables of one shape wherever they are filed, which
   is how the copies are found without reading their rows.

5. **A landed row is text, as decoded.** `legacy_rows.cells` is a JSON array by
   column ordinal — an array, because `ozəl-ham` heads two columns `Müq.` and two
   `Qovluq`. A deleted dBase record is landed with `deleted` and never mapped.
   `contentHash` finds one record filed twice.

6. **Every canonical row names the landed row that stated it.** `legacyRowId` on
   the object, address, holder, document, alias, locator, attribute and
   collective, `SET NULL` on delete. `sourceDatabase` stays: it is what the
   summary counts by and what the seed and the import template write, and those
   have no landed row.

7. **The spine grows where the store proved it had to, and nowhere else.**
   - _Locators are many._ One `mulk.DBF` row has a register book and page and a
     technical passport book and page; the house inventories locate by `Opis`;
     one workbook is "the ones in the box". `archive_locations` loses its unique
     object key and gains `kind`, `inventoryList`, `box` and `position`.
   - _An address keeps the parts the register kept apart_ — district,
     settlement, massif, street, house, lane, apartment, plot number, postal
     code — beside the whole `value`, which is still what matching reads. Parts
     are never split out of a one-cell address.
   - _A holder has a standing and a history._ `Current | Former | Unknown`,
     `acquiredOn`, `endedOn`, `basis`, and the name parts where a source kept
     them (`ident3.dbf`). `tarix.DBF` is a history, and a register that could
     only name the owner would drop it.
   - _Papers are no longer one per kind per object._ The history tables give one
     case several orders and decrees over the years.
   - _More numbers._ `CaseFile` (`NOMKV`), `Order`, `Contract`, `Decision`,
     `PlotNumber`, `LegacyId` (`IDENT_COD`).
   - _A collective_ — garden association, dacha massif, sovkhoz — is a record
     of its own that an object points at.
   - _Everything else goes to `registry_attributes`_, under the name its register
     gave it. A field that turns out to matter is promoted to a column by a
     migration that reads it back from there.

8. **Password tables are never landed.** The file and its table header are
   recorded, the file is `Skipped` with `Credentials`, and no row of it is
   written. The register has no use for them, and a database is a worse place
   for a password than a forgotten share.

## Alternatives rejected

**Mapping straight into the spine, as the upload does.** One layer fewer, and
every mistake in the lexicon becomes permanent until someone re-uploads 1 848
files. The upload of ADR-0012 can afford it because an operator is holding the
file; a worker reading a bucket is not.

**A column per source field.** `mulk.DBF` alone would add 34, a third of them
unexplained, and `ident3.dbf` 25 more — a schema of guesses that migrates with
every register found. The attribute table holds them until somebody knows what
they are.

**Rows as JSON keyed by header.** Readable, and wrong for the sheets that head
two columns the same way — the second value would overwrite the first.

**Leaving the noise out of the database.** Cheaper, and it makes "skipped" and
"never arrived" the same answer.

**Doing the work in the webhook request.** Loses events to timeouts on exactly
the files that matter — the largest ones.

## Consequences

- **The schema is ahead of the code.** Nothing writes the landing layer or the
  new spine columns yet: the worker, the RustFS notification endpoint, and a
  dBase reader are still to be built. Until then the import of ADR-0011 and
  ADR-0012 and the seed write the spine exactly as before, with
  `legacyRowId` null.
- **The published record still has one locator.** `ArchiveRecordDto.location`
  is a folder and a page range. The first locator of that shape answers; a case
  located only by book or box answers with none until the contract can say so.
- **The database will be large.** `mulk`, `tarix`, `order.xlsx` and `ident3`
  alone are over a million landed rows. TECH_DEBT §9 — matching reads the whole
  address table — fires the day they are mapped, not later.
- **What the DBF fields mean is still a reading of their names.** `OTAG` is
  taken for rooms and `tarix` for a history because that is what the words mean;
  nobody has read a value. The attribute table is what keeps that from being a
  loss if the reading is wrong.
