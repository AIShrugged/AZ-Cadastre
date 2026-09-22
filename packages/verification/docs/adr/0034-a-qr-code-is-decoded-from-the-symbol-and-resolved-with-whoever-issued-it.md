# A QR code is decoded from the symbol, and resolved with whoever issued it

Date: 2026-09-22. Status: accepted.

Amends [ADR-0028](./0028-a-decree-439-paper-is-held-against-the-archives-copy-by-its-qr-code.md)
on where a QR reference comes from and who may answer about it, and
[ADR-0031](./0031-a-qr-check-with-no-code-to-check-is-skipped-and-said.md) on
which papers the check is made for. ADR-0032 is untouched and still decides
which of two absences is told.

## Context

The customer opened a package on the stand and asked why the QR check does
nothing — naming the register extract, which prints a code on its face
(COMM-133). The package is the Hümbətov submission, 39 sheets, and it is worth
saying exactly what was found in it, because every clause below is one of these
facts.

The profile read `qr_code` off a paper the way it reads a name off it: by asking
the model for the text printed beside the code, with a note forbidding it to
read the picture. The reasoning in ADR-0028 was that a decoded guess is a value
nobody can check against the paper. On sheet 1 of that package — the register
extract — there is no text beside the code, and the reader returned `[QR code]`
at confidence 0.60: the mark the transcription puts where a picture was. That
value is not empty, so `withoutAQrCode` counted the package as having had a code
read off it and compiled no `QrCodeUnavailable`; the extract is sourced from MQS
and so got the type-wide `IntegrationNotConnected`; and the report said nothing
whatever about the step. A code on the face of the sheet, and every line of the
report silent about it.

Sheets 31 and 32 carry the archive's real link in text, and the reader
transcribed it twice and got it wrong both times, in the `I`/`l` and in the
`J`/`j` — the two readings do not even agree with each other. Neither resolves:
the service answers `Yanlış şifrələnmiş Case ID`.

Decoding the symbols off the same sheets gives, first time, every code whole:

| Sheet | Paper                                          | Payload                                                               |
| ----- | ---------------------------------------------- | --------------------------------------------------------------------- |
| 1     | register extract                               | `https://e-emlak.gov.az/eemdk/az/CheckElectronExtract/qr?r=…&q=…&t=…` |
| 19    | application (a notarial deed among its sheets) | `http://notariat.az/Document/GetPdf?ActionId=…`                       |
| 31    | archive certificate                            | `https://qr.esd.milliarxiv.gov.az/info/alOOwj1…`                      |
| 32–33 | disposal order                                 | the same archive link                                                 |

Three facts fall out of that table, and each of them contradicts something the
profile assumed.

**A symbol is not a reading.** A QR code carries its own error correction: a
payload comes back whole or does not come back. The objection ADR-0028 raised —
a guess nobody can check — is an objection to a model looking at a picture, not
to arithmetic. The `[QR code]` on sheet 1 is what asking a reader actually
produced.

**The archive certificate and the disposal order print codes.** ADR-0028 held
the certificate to carry none and left it `IntegrationNotConnected` for good;
the order is sourced from the package and was never asked about at all. They are
the two sheets of this package whose codes resolve anywhere, and both were
excluded.

**The archive's service verifies signatures; it does not hold records.**
`qr.esd.milliarxiv.gov.az` is reachable from a server, which TECH_DEBT §14 left
open. Its page asks
`GET …/signature-info/api/v1/signature-info/verifyQr?id=<case id>`. Asked that
on 2026-09-22 with the code decoded off sheet 31, it answered — and this is the
whole of the answer:

    signerName        the director who signed it, by name
    signatureDate     2026-01-14T17:07:07.000+04:00
    signatureValidity true
    org               AZƏRBAYCAN RESPUBLİKASININ MİLLİ ARXİV İDARƏSİ
    unit              … / DÖVLƏT ARXİVİNİN BAKI FİLİALI DİREKTOR
    contentUrl        a presigned link to the signed PDF, good for an hour

Who signed the electronic original, for which body and section, whether the
signature verifies, and where the file is. (The signer's name is a value off
somebody's papers and is not written out here, for the reason no reading is —
ADR-0008.) Nothing about the paper's contents:
no document number, no holder, no address. So the eight lines of ADR-0028's
comparison come back empty from it — and an answer of eight `NotStated` lines
was, until this ADR, read by `found` as "nothing disagrees" and reported
`Confirmed`. The check's one forbidden verdict, reached by connecting the real
archive.

## Decision

1. **The code is decoded, not read.** A new outbound port, `QrCodeReader`,
   answers with the payloads decoded off one sheet. It has no provider to choose
   between and never will: there is nothing for a stand-in to stand in for and
   nothing an API key would buy. The adapter scans the whole sheet at four
   sizes, stopping at the first code, and only a sheet that yields nothing whole
   is taken apart into tiles — which is what finds the stamp-sized code in the
   corner of a register extract.

2. **The codes are recorded with the transcription, on `OcrResult`.** Both are
   what a machine got off this sheet; they are written together, read back
   together and replaced together. They differ in what they are worth, and that
   difference is why the codes carry no confidence of their own.

3. **`qr_code` is the decoded code and nothing else.** The extraction prompt no
   longer lists the key, the offline extractor no longer answers it, and the
   aggregate drops any `qr_code` a reader returns and substitutes the first code
   decoded across the paper's sheets, at confidence 1. A paper whose profile
   declares no `qr_code` gets none, whatever its sheets carry.

4. **Every paper that prints a code is resolved.** `isCheckedByItsQrCode` is
   "the schema declares `qr_code`", and that is all — thirteen types today
   rather than eleven, the register extract and the plan of the plot among them.
   What a paper is compared _on_ did not widen with it:
   `isHeldAgainstTheArchiveByQr` is unchanged and still names the eleven the
   archive can be held to line by line.

5. **A code whose issuer is not connected is said, per paper.** A new status,
   `IssuerNotConnected`, carrying the host the reference names. It is the
   absence `IntegrationNotConnected` states for a whole type, narrowed to one
   sheet and naming the service that would settle it — and it replaces the
   type-wide line for that paper, so the same absence is not told twice
   (ADR-0032's rule, applied to a second pair). Informational, exactly as
   `NotFound` and `NoQrCode` are.

6. **An answer may be about the sheet instead of about what it says.**
   `ArchivedDocument` gains a signature block — signer, organisation, unit,
   date, and whether it verifies — and `ArchiveQrCheck` carries it through to
   the report. A signature that verifies is evidence of a different kind and not
   a lesser one: it says nobody altered this sheet. A signature that does not
   verify is `Differs`, and a stronger finding than any single line — the lines
   are what the paper says, and this is whether the paper is the paper.

7. **An answer that states nothing is not a confirmation.** Where every line is
   `NotStated` and there is no signature, the check answers `NotFound`: from the
   caller's side an entry holding nothing is an empty shelf, and it is told the
   same way.

8. **Competence is judged only where there is a rule and a body.**
   `issuingAuthorityCompetent` is null unless the Decree's table covers the type
   _and_ the answer names the body that issued the paper. A signature service
   names the office that attested the copy, and judging the archive's Baku
   branch on whether it could allot land in 1998 is not a question anybody
   asked.

9. **The archive can be pointed at.** `NATIONAL_ARCHIVE_PROVIDER=http` calls its
   electronic document service; `mock` stays the default, because pointing it at
   the real thing sends a case id off the machine. The stand-in is keyed by the
   code the decoder reads off sheet 6 of the Rusadze package — until now it was
   keyed by a reference of our own, invented because the token was not legible
   as text, which answered `NotFound` to every real package there is. Either
   adapter refuses a reference it did not issue rather than answering about it:
   one service's identifiers are not another's to be told about.

## Consequences

- Two migrations: `codes` on `ocr_results`, and the new enum value with the
  issuer and signature columns on `archive_qr_checks`. Nothing is backfilled —
  no run before this decoded anything — and a re-run of a package fills them.
- The contract gains a status and a `signature` block; a client exhausting
  `ArchiveQrCheckStatus` has to name `IssuerNotConnected`.
- On the package that prompted this, the register extract stops being silent:
  its code is decoded and the report says it is issued by `e-emlak.gov.az`,
  which is not connected. That is not a confirmation, and it is the first thing
  the report has ever said about that sheet.
- A sheet costs about a fifth of a second to scan, and about half a second when
  nothing is found and the tiles run. It is asked for alongside the
  transcription, so the decoding fills the wait on the reader.
- `QrCodeUnavailable` is compiled for fewer packages still: every carrier in
  force now has a line of its own, so ADR-0032's condition is met wherever the
  package holds any carrier at all. That is what ADR-0032 decided, reached from
  the other side.
- The archive's own service is a signature service. Holding a paper against a
  copy of it line by line — the whole of ADR-0028's comparison — still has no
  live counterparty, and TECH_DEBT §14 says so.
- `contentUrl` is read off the answer and deliberately not kept. The link is
  presigned and expires in an hour; an inspector opens a report long after the
  run that made it, and a stored link that is dead by the time anybody clicks it
  is worse than no link — it looks like the archive lost the file. Putting the
  archive's own PDF in front of the inspector means fetching it when they ask,
  which is a feature and not a column.
