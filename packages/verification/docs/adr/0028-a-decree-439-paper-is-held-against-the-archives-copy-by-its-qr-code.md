# A Decree 439 paper is held against the National Archive's copy of it by its QR code

Date: 2026-09-16. Status: accepted.

Amends [ADR-0025](./0025-the-required-set-is-the-provision-of-article-8-the-case-falls-under.md)
for one source: a paper the profile sources from the National Archive and reads
for a QR code is no longer only reported `IntegrationNotConnected`. The other
three systems — MQS, the Licences Portal, the Urban Planning Committee — are
unchanged.

## Context

The acceptance contract asks, of every Soviet-era title under Presidential Decree
No. 439, the number and date, the issuing body, the person, the address, the
plot, the item of the Decree, the fond-inventory-file-sheet of the archive — and
the QR code the archive prints on its certified copies. Its source column names
the National Archive Fund. Since ADR-0025 the profile has read those lines and
reported every such paper as read and not confirmed (TECH_DEBT §14).

No archive is connected, and nobody yet knows whether the archive's QR links may
be followed by a server at all. The customer's Rusadze Vera Vladimirovna package
carries the archive's certified copies of the 1998 order allotting her plot, and
it is the case the confirmation has to be shown on.

A name matching is not the whole question. A homestead allotment signed by a
kolkhoz board would match the archive's copy letter for letter and still found
nothing: item 2.7 of the Decree takes a decision of the local executive
authority, and the question is whether the body that issued the paper could
issue a paper of that kind.

## Decision

1. **One outbound port, `NationalArchivePort`, asked by the QR reference.** It
   answers with the archive's copy of the paper — the eight lines, as the archive
   states them — and the name and **kind** of the body the archive files it
   under, or with nothing. Facts and no verdict, as the archive register does
   (ADR-0009). An archive that throws leaves the paper unchecked.

2. **Only the offline stand-in exists, and it is the default.**
   `NATIONAL_ARCHIVE_PROVIDER=mock` is the only value. The stand-in holds the one
   paper of the Rusadze case, under a QR reference of our own — the token of the
   real link is not legible on the scan — and the offline extractor reads every
   Decree 439 paper as that order, so a run on `mock` confirms it.

3. **Which papers: worked out, not flagged.** A type is held against the archive
   when the profile sources it from the National Archive, reads it for the QR
   code and all eight lines, and the competence table names it
   (`isHeldAgainstTheArchiveByQr`). Eleven types answer today. The archive
   certificate is sourced from the archive and carries no QR code, and stays
   `IntegrationNotConnected`. The catalogue's own Decree 439 entries are not
   read for fields and are not asked about.

4. **The verdict is the domain's.** Each line is `Match`, `Mismatch` or
   `NotStated` — silence on either side is never a disagreement — by a rule per
   line: a number by its characters, a date by its day, an area by its square
   metres (400 kv.m is 0.04 ha), the item of the Decree by its number, the
   archive reference by its four numbers, and names, bodies and addresses by the
   rule two papers of one package are already held to. Competence is a fact of
   its own: a table of which kinds of body could issue which paper, read off the
   Decree's items as the profile's descriptions quote them. It is our reading and
   not a published table, with the reservation TECH_DEBT §15 makes of the
   archive's sections.

5. **The status is derived and never handed in.** `Confirmed` when every line
   both sides state agrees and the issuer was competent; `Differs` otherwise;
   `NotFound` when the archive holds nothing under the reference; `NoQrCode` when
   none was read off the paper.

6. **One answer per document, kept with the document.** Stored in
   `archive_qr_checks` with its lines, published as `DocumentDto.archiveQrCheck`,
   and kept when another file arrives — it is about what this paper says. The
   stage runs after the register and before gathering, and reads only what was
   read off the paper itself (ADR-0023).

7. **In the report.** A paper with an answer no longer gets
   `IntegrationNotConnected`. `Differs` is `ArchiveQrMismatch`, filed against
   the document and held against the package, naming the lines that differ and,
   separately, an issuer with no competence. `NotFound` and `NoQrCode` are
   `RegistryUnconfirmed`: an absence of evidence, told and not held against the
   package. `Confirmed` adds nothing; the answer is on the document.

## Consequences

- A run on `mock` reports the Rusadze order confirmed on all eight lines. Any
  other Decree 439 paper read on `mock` carries the same QR reference and the
  same values, which is what a stand-in is; against a real extractor it will
  carry its own reference and come back `NotFound` until an archive is connected.
- `NoQrCode` is reported, where the contract left it unsaid: a paper nobody could
  ask about was not confirmed, and silence would read as a pass.
- Connecting the archive is a new adapter behind the port and one more value of
  `NATIONAL_ARCHIVE_PROVIDER`. The competence table and the line rules do not
  move.
- The area rule is the third copy of the unit table (TECH_DEBT §7).
