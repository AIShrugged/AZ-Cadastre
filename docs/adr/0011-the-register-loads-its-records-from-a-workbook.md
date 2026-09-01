# The register loads its records from a workbook, and the loader is not part of what it promises

Date: 2026-09-01. Status: accepted.

Extends [ADR-0010](./0010-the-register-holds-its-records-in-its-own-database.md)
and supersedes none of it. That ADR gave the register a database of its own and
a schema derived from the customer's six workbooks; it left the only way into
that database a TypeScript seed. This one adds the other way in — an upload —
and says why it is the register's own tool rather than part of the language two
systems agree on.

## Context

The seed is the customer's two cases and four records kept for behaviour the
fixtures had. It is a source file: adding a record means writing TypeScript,
rebuilding and re-running it. That is right for cases the repository is built
around and wrong for everything else — the barrier the customer's own analysis
names is that the registers are Excel files and "not queryable via API in their
current state", and there are 55 of them.

What the six schema workbooks establish is that the material arrives as
spreadsheets and will keep arriving as spreadsheets. Somebody with the register
files and no TypeScript has to be able to put them in.

## Decision

1. **The import is an endpoint of the stand-in and not part of the published
   contract.** `POST /api/import/records`, wired stub-local in
   `apps/registry-stub`, with its Zod schemas in `src/application/` and none of
   them in `libs/api-contracts`. What the register promises the rest of the
   world is `ArchiveRegistryApi` — what it holds about a property, and which of
   the package's papers the archive has the original of (ADR-0009 §4, ADR-0010
   §4) — and no verification of a submission ever loads a register file. The two
   are different audiences: the contract is what a caller may ask, and this is
   what an operator does to the register. Publishing it would put an
   administrative tool in the language a real state register would have to
   implement, and a real state register has its own way in.

2. **The workbook is a sheet per model, joined on the object key.** `Objects`,
   `Addresses`, `RightHolders`, `Documents`, `Aliases`, `Locations` — the six
   models of ADR-0010 §2, column for column, with each child sheet naming its
   object by `(territorialOffice, registerNo)`. Not the shape of the customer's
   own registers, deliberately: those are six different shapes, one per office,
   and the normalised spine is what all six were already mapped onto. A template
   in the models' own shape is one file to keep in step instead of six.

3. **Everything is text, and `buildYear` is the exception that proves it.** The
   reader hands back what the cell says rather than what a spreadsheet library
   thinks it means, because a register number is `003013067339-10301` and a
   reader that saw a number would drop the leading zero — which is how some of
   the archive's own registers lost it. `buildYear` is the one column of the
   whole schema that is arithmetic; it takes four digits and refuses
   `1984-cü il` rather than guessing at it.

4. **A workbook that is partly wrong is answered with a report, not an error.**
   An object with anything wrong in any of its rows is refused whole — the unit
   of an import is an object with its children, and storing the object without
   the address the file gave it would tell the operator the record went in and
   never that a spelling did not. Every other object still goes in, and the
   answer is a report naming the sheet, row and column of each refusal. The one
   published refusal shape, `ErrorBody`, carries a sentence; what an operator
   loading a register file needs is the table. Only a file that is not a
   workbook of register records at all is an error.

5. **A refusal names where, never what.** Sheet, row and column and no value,
   in the report and in the log alike. Whoever uploaded the file can open it at
   the row; the register has no business copying somebody's property data back
   out of a file it refused (ADR-0008).

6. **`exceljs` is the new dependency, and it is behind a port.** It is on
   `apps/registry-stub` alone. The import knows it as `WorkbookReader`, which
   answers in sheets of text and nothing else, so the mapping and the validation
   are covered by a unit spec with no library in them and the day the format is
   `.ods` or a stream is one adapter.

## Alternatives rejected

**Publishing the import in `libs/api-contracts/src/registry`.** It would make
the shape available to the verification context, which must never load a
register file, and it would make an operator's workbook part of what a real
state register has to answer. ADR-0009 already draws that line: the contract is
the part that does not change when the stand-in is deleted, and this endpoint is
deleted with it.

**Extending the seed instead of adding an endpoint.** The seed stays what it is
— the two customer cases, in code, idempotent, run by `db:seed`. Turning it into
a file reader would make the repository's own fixtures depend on a file nobody
reviews in a diff, and would still leave the operator needing a shell on the
container.

**All or nothing per workbook.** Simpler to reason about and it makes a 55-file
load unrecoverable: one bad row in a register of thousands means nothing goes in
and the whole file has to be uploaded again. Per object, one bad row is one
object to fix.

**Importing valid rows of a refused object.** The opposite mistake. The report
would say the object was stored, and the register would answer to fewer
addresses than the file gave it — which is a record that looks complete and is
not.

**`xlsx` (SheetJS) rather than `exceljs`.** The versions published to npm are
not the ones its authors maintain, which is a supply chain we would have to
explain rather than one we chose.

## Consequences

- **A template ships with the app.** `apps/registry-stub/fixtures/registry-import-template.xlsx`,
  built by `pnpm fixtures:template` from `fixtures/build-template.mjs` so that a
  committed binary cannot quietly stop matching the schemas. Its two positive
  records are the seed's own two cases value for value, so loading it into a
  seeded register changes nothing — which is how the API set proves the import
  is idempotent. Its third record is invalid on purpose.
- **The whole workbook is held in memory and written in one transaction.**
  Capped at 25 MB, which is a register file and not 55 of them, and Prisma's
  five-second transaction default is raised to two minutes. It is right for a
  file an operator uploads and it is not a bulk ingest pipeline: the day the 55
  files are loaded in anger, this endpoint is what proves the mapping, and the
  loader that uses it streams.
- **The register can now be changed over HTTP by anyone who can reach it.**
  There is no authentication in front of it, because there is none in front of
  anything here yet — the stand-in has no notion of a caller. It listens on the
  compose network beside the server and must not be published as it stands.
- **A column no model names is ignored rather than refused.** The archive's own
  registers carry a clerk's note and a settlement's tally beside the data, and a
  file refused for one of those would be a file nobody could load. The cost is
  that a mistyped header is silence: the column it should have been is reported
  only if it was required.
