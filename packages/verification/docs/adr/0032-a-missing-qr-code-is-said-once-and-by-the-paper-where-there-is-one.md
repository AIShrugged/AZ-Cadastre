# A missing QR code is said once, and by the paper where there is one

Date: 2026-09-21. Status: accepted.

Amends [ADR-0031](./0031-a-qr-check-with-no-code-to-check-is-skipped-and-said.md),
decision 1, which compiled `QrCodeUnavailable` over the whole package and named
in it every paper that could have carried a code. Builds on
[ADR-0028](./0028-a-decree-439-paper-is-held-against-the-archives-copy-by-its-qr-code.md),
which gave each Decree 439 paper a line of its own for the archive's answer.

## Context

The two decisions were taken a day apart and met on `main`. ADR-0031 says the
package-wide line, and names in it the papers that could have carried a code;
ADR-0028 says, per Decree 439 paper the archive was not asked about for want of
one, a `RegistryUnconfirmed` against that paper's own sheet.

Where a package carries Decree 439 papers and none of them prints a code, both
fire. The inspector reads the same absence twice: first as a package line
listing the types, then once more against each of the papers it just listed.
Noticed while the two branches were being merged (COMM-104), and left to the
backend to settle (COMM-96).

Which of the two to keep is not a free choice. The per-paper line is the one an
inspector can act on — it names the sheet to open. The package line is the only
thing that can be said where there is no sheet to name, and it is what the
customer asked for in ADR-0031: the report has to mark that the step did not
happen. Neither can simply be dropped: `land_plot_plan` is required of every
package (Article 10.2.2) and prints a code, and it is held against nothing —
MQS is not connected, so no line of its own would ever say its code went
unread.

## Decision

1. **A paper that carries the finding carries it alone.** `QrCodeUnavailable`
   names only the papers in force no line of their own says this of — those
   with no `archiveQrCheck`. Where every carrier in force has one, the per-paper
   lines say the whole of it and `QrCodeUnavailable` is not compiled.

2. **Everything else of decision 1 of ADR-0031 stands.** It is still compiled at
   most once per report, still only where no paper in force had a code read off
   it, still filed against no document, and it still says the package carries no
   paper of a kind that prints one when it names none.

3. **The predicate is "has a line of its own", not "is a Decree 439 paper".**
   The aggregate asks whether the archive answered about the paper, because that
   is what decides whether the report already speaks about it. With no code read
   anywhere the only answer such a paper can hold is `NoQrCode`, so the two read
   the same today; a paper held against some other system tomorrow would be
   caught by the same condition without this decision being revisited.

## Consequences

A package of Decree 439 papers with no codes loses its package line and keeps
one line per paper. A package whose only carrier is the plan-scheme is
unchanged. A package carrying both keeps the package line, now naming the
plan-scheme alone.

No contract, schema or migration moves: `QrCodeUnavailable` is the same kind,
compiled in fewer reports. Stored reports are not rewritten; a re-run
recompiles them.

Reversible. If the package line reads better in the cases than the per-paper
ones do, decision 1 goes back to ADR-0031's and this is superseded.
