# The archive's own sheet is read by a reader, and a fragment never accuses

Date: 2026-09-23. Status: accepted.

Narrows [ADR-0035](./0035-one-paper-is-checked-by-its-qr-code-and-against-the-archives-own-pdf.md),
which decided that the eight lines of the comparison come off the signed PDF the
QR code leads to, and says how. Amends the comparison of
[ADR-0028](./0028-a-decree-439-paper-is-held-against-the-archives-copy-by-its-qr-code.md).

## Context

The QR check on the Hümbətov package reported `Differs`, with the address and the
area both `Mismatch`. The package is valid: every line the archive prints agrees
with the paper in hand. The finding was ours.

ADR-0035 read the signed PDF with a label table — the same one the signature
panel is read with — matching a schema's label against the text and taking
whatever followed it. That works on a panel of labelled rows, which is what the
electronic document service renders under the paper. It was never going to work
on the paper, and this sheet is why: the archive's copy is a **covering letter
to the applicant with a 1999 order copied out under it in prose**. There is not
one labelled row on it. What the matcher found were labels inside ordinary
words:

| line                | label    | matched inside                                 | answered                          |
| ------------------- | -------- | ---------------------------------------------- | --------------------------------- |
| `property_address`  | `ünvan`  | `ünvanında qeydiyyatda olan`                   | `nda qeydiyyatda olan`            |
| `plot_area`         | `sahəsi` | `torpaq sahəsinin ayrılmasını xahiş etmişdir.` | `nin ayrılmasını xahiş etmişdir.` |
| `decree_item`       | `bənd`   | `bəndini rəhbər`                               | `ni rəhbər`                       |
| `archive_reference` | `fond`   | `arxiv fondu üzrə`                             | `u üzrə`                          |

The sheet reads perfectly well and states almost everything asked of it:
`SƏRƏNCAM № _100_ “21” _04_1999-cu il`, `XƏTAİ RAYONU İCRA HAKİMİYYƏTİNİN
BAŞÇISI`, the holder, `Əbilov küç. 17. 18 saylı evin yaxınlığında`, `0,06 ha`,
and `ƏSAS: Fond-128, siy.1, iş-1043, vər.-69, 70, 72`. Read by a person it is a
confirmation on seven lines. The order prints no item of Decree 439 at all, so
`decree_item` is honestly null.

Two faults, and the second is the one that matters. The reading was wrong; the
comparison then turned a reading of ours into an accusation against somebody's
paper.

## Decision

1. **The sheet is read by the extraction stage, not by a parser.** There is
   nothing in prose to key a parser to, so there is no parser to fix. The pages
   of the signed PDF go to `FieldExtractor` — the same port, the same provider
   choice and the same prompt machinery every sheet of a package goes through —
   under a schema of their own. No second reader is kept in the codebase.

2. **That schema is a document type of its own, `archive_signed_copy`**, and not
   `disposal_order`. What the file holds is the archive's letter plus the order;
   a reader told it is holding a disposal order looks for the order's own
   letterhead and finds the archive's. Its notes say the one thing the sheet
   turns on: every value belongs to the copied-out document, never to the
   covering letter, which prints a date and an outgoing number of its own
   directly above it.

3. **The offline extractor refuses to answer about it.** Every other stand-in
   answer is a table, which is fair for the repository's own papers; this sheet
   is whatever file the code in somebody's hand leads to, and a table would have
   the comparison hold their order against `ELÇİN ƏLİYEV`. Asked about this
   type, the stand-in returns nothing, and the stage answers from the `verifyQr`
   metadata alone — what it answered before ADR-0035.

4. **A reading that cannot be recognised as a value of its line is `NotStated`,
   never `Mismatch`.** In the domain, on both sides of the comparison, whatever
   read them. A figure line is recognised by whether its figure parses at all;
   the three prose lines — a body, a person, a place — by their first letter,
   because each is a proper noun or a house number on every paper the archive
   holds and a value opening in lower case is the middle of a sentence. The rule
   is deliberately weak: it says a reading is the _kind_ of thing the line holds,
   not that it is right, because a rule strict enough to reject an unusual but
   genuine value would hide the disagreements the check exists to find.

   This is the part that is not about one sheet. A false `Differs` is the worst
   outcome this check has — worse than missing a real disagreement — because an
   inspector told the archive denies a paper stops looking at it. No future
   misreading may cost that again.

5. **The failure direction is silence.** A reader that refuses, times out or
   answers nothing leaves eight nulls, which reach the inspector as `NotStated`.
   A reading of ours that failed is never a finding about their paper.

## Consequences

`ExtractionSheet.image` becomes nullable. A born-digital PDF read off its own
text layer was never rendered, and rendering it to show the model a picture of
what it has already read verbatim would cost a page of tokens a sheet. Every
sheet of a package still has one — they arrive as scans.

`textLayerOf` answers one string per page instead of one for the file, so the
extraction request can carry sheets the way the OCR path does. Whether the layer
is worth the name is still decided over all the pages together: a scan's stamped
footer is a few words on every sheet, and asking each sheet on its own would let
a long enough scan through.

Reading the archive's copy now costs a model call per resolved code, where it
cost nothing before. It is one call on one paper of a package, and it is the
same provider choice as every other stage.

`ArchiveQrCheckDto` does not change. The eight lines are the eight lines; what a
report draws from them is unchanged.

The sheet's own text is a fixture — `test/humbetov-sheet.fixture.ts`, the text
layer as it read on 23 September 2026 — because the presigned link it came from
lives an hour and the file cannot be checked in under it. The four fragments are
in it too, so the guard is tested against what actually happened rather than
against a sentence somebody made up.
