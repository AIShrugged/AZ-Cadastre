# The register reads the archive's own workbooks, and a model says which one it is holding

Date: 2026-09-07. Status: accepted.

Extends [ADR-0011](./0011-the-register-loads-its-records-from-a-workbook.md) and
supersedes none of it. That ADR gave the register an upload and a template in the
shape of its own models, and said in §2 that the customer's own registers were
"six different shapes, one per office" and that a template was "one file to keep
in step instead of six". This one keeps the template and adds the six shapes
beside it, and says why that stopped being a good trade.

## Context

The template assumed somebody would transcribe a register into it. Nobody will.
The six workbooks in `Fedor Zhernovoy/` are the files the archive stores, they
are what an operator has on disk, and there are fifty-five more behind them. A
loader that only reads a shape nobody keeps their data in is a loader with a
transcription step in front of it, and the transcription is the work.

The six files also turned out to be more legible than the "six different shapes"
line assumed. They document themselves: column A of every sheet labels the row,
and the first rows are the office's Azerbaijani headers, an English translation,
a description of each column and an example. Forty-odd sheets across six files
head their columns in about a hundred and forty distinct ways, and those hundred
and forty resolve onto some forty-five things a row can say. That is a
dictionary, not six parsers.

What is not mechanical is knowing _which_ file you are holding. Two of the six
carry a sheet called `Sheet1`, and two are written in the Azerbaijani Cyrillic
code page. An office that renames a sheet, adds a column or saves in a different
code page has still sent that register. Recognising a file from a family
resemblance is the thing a rule is bad at and a model is good at, and it is the
only place in this service where that is true.

## Decision

1. **One endpoint reads both workbooks, and the sheet named `Objects` decides
   which.** `POST /api/import/records` is unchanged. A workbook carrying an
   `Objects` sheet is the register's own template and is read as ADR-0011 says;
   anything else is put to the classifier. Nothing is asked of a model that the
   sheet names already answer, and the report says which of the two was read,
   which register it was taken for, and who worked that out.

2. **What a column means is a lexicon, asked once for all six registers.**
   `domain/archive-registers/header-lexicon.ts` maps every spelling that has
   actually been seen — `Ünvan`, `Ünvanı`, `Əmlakın ünvanı`, `Adress`, `Цнван` —
   onto one of some forty-five fields a source row can carry, and
   `application/native-register.mapping.ts` places those into the six models. A
   header nobody has seen is left unread rather than guessed at.

   Each column is read through _every_ header row the sheet gives it, the
   office's and the English one, because a bare `№` is a row number in
   `Q.yas-icara` and a state act number in `KADASTR` and only the English header
   says which. Where the two disagree the more specific reading wins.

   What is _not_ in the lexicon is in the catalogue, one entry per register:
   whose numbering its register numbers belong to, what kind of paper a row of it
   records, and the sheet names and marker headers that identify it. A seventh
   register is a catalogue entry and no new code — which is not a claim, it is
   what happened: the technical passport database was catalogued after the other
   five and cost one entry, six lexicon lines and one field on the descriptor.

3. **Which register a workbook is, is a port with two adapters, and the rule is
   the default.** `WorkbookClassifier` is answered either by the fingerprint —
   which scores the file's sheet names and marker headers against the catalogue —
   or by a model reading the same shape. `WORKBOOK_CLASSIFIER_PROVIDER` chooses,
   and it defaults to `mock`, so the import path runs with no API key and no
   network, exactly like the model-backed stages of the verification pipeline.

   The model is not trusted blind. It may only name a register the catalogue
   carries; anything else and the rule's answer stands, and a provider that
   cannot be reached is a warning and the rule's answer, never a failed upload.
   The report carries `detectedBy`, so an operator is never told a file is
   something on nobody's authority. Both are asked the same question about the
   same shape, which is what makes the model-backed one checkable rather than
   merely believed.

   The classifier is shown sheet names and header rows and never a record.
   Recognising a file does not need anybody's property data, and sending it to a
   provider to be told what file this is would be sending it for nothing
   (ADR-0008).

4. **A row of a source register is never refused.** ADR-0011 §4 refuses an object
   whose rows the template's schema rejects, and that is right for a file
   somebody filled in: they can fix it. Nobody can fix a register the archive
   wrote in 1998. So a row with no register number is keyed by the number of the
   paper it records — a privatisation certificate number is something an
   inspector can look a case up by — and a row with no number at all is keyed by
   its own place in its own book, written as `List 1 #2` so that nobody mistakes
   it for a register number. A sheet the lexicon can name nothing in is a README
   and is reported as skipped, once, rather than four hundred times.

5. **An object is keyed by the office as well as the number, and two of these
   registers prove it.** The technical passport database numbers passports from
   1 within each region: `Лист2` holds passport 2257 in Sumqayıt and `Лист4`
   holds passport 2257 in Qusar, and they are two buildings. So a register may
   declare that the office is written on the row, and that one is keyed by
   `(region, passport number)`. This is ADR-0010's "unique per territorial
   office rather than globally" arriving as a fact about the data rather than as
   a modelling choice.

6. **A handover row is two objects.** The Hövsan registers carry, on one row, the
   Absheron office's registration and register numbers and the Baku office's,
   because the case was transferred between the two offices in 2008 and the old
   entry was never closed. Both are real records of one house, so the row becomes
   two objects — which is what ADR-0010 keyed an object by its office in order to
   allow — and each carries the other office's registration number as an alias.
   The other office's _register_ number is not aliased: it is the key of the
   second object, and what joins the pair is the inventory number both carry.

7. **Which row of a sheet is a header is a domain rule, not the reader's.** The
   reader hands back a grid of text and makes no judgement at all. `tableOf`
   decides what the labelled rows mean, because all six of these files document
   themselves and one puts a merged title above that, and that is knowledge about
   the archive's files rather than about `.xlsx`. It is therefore testable with
   no spreadsheet library in the room, which is what it needed to be.

8. **The fixtures are the customer's own files with rows in them.**
   `fixtures/build-archive-fixtures.mjs` opens each of the six, keeps every row
   the sheet labels as its own documentation, drops the example, and writes
   records underneath. A fixture is therefore not an imitation of the file and
   cannot drift from it. The records are off the customer's own application
   packages — chiefly `INPUTS/AZkadastr.pdf`, the Bülbülə land plot the
   end-to-end scenario runs — at addresses no seeded record answers to, because
   two records at one address is an `Ambiguous` lookup and a fixture that
   produced one by accident would break the case it exists to prove.

## Alternatives rejected

**Transcribing the six registers into the template.** It is the work, it has to
be redone for every one of the fifty-five, and every transcription is a chance to
lose a leading zero — which is how some of the archive's own registers lost
theirs (ADR-0010 §2).

**A parser per register.** Forty-odd sheets, six parsers, and every one of them
carrying its own opinion about what `Ünvanı` means. The columns are the same
forty-five ideas throughout; six copies of that knowledge is six places to fix a
spelling.

**Letting the model map the columns as well as name the file.** It would be a
model deciding that a cell is a register number, which is the value the whole
schema is keyed by, on an answer nobody can check. The lexicon is checkable, is
free, and is right about every column of all six files; the model is asked only
the question the lexicon cannot answer.

**Making the model the default.** Then no part of the import runs offline, a CI
run costs tokens, and the rule it is supposed to be compared against is never
exercised. The verification pipeline defaults every one of its model-backed
stages to `mock` for the same reason.

**Publishing the classifier in `@cadastre/api-contracts`.** Same answer as
ADR-0011 §1 and for the same reason: no verification of a submission ever loads a
register file, and this is further inside the operator's side of the register
than the import itself.
