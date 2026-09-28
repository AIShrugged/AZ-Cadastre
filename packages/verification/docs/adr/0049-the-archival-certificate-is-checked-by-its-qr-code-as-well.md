# The archival certificate is checked by its QR code as well

Date: 2026-09-28. Status: accepted.

Amends [ADR-0035](./0035-one-paper-is-checked-by-its-qr-code-and-against-the-archives-own-pdf.md)
on which papers have their code resolved. Everything else ADR-0035 decided — the
archive alone answers, the eight lines come off the archive's own signed PDF, the
signature panel carries six lines — is untouched and applies to the second paper
exactly as it does to the first. ADR-0032 still decides which of two absences is
told.

[ADR-0048](./0048-a-signature-vouches-for-the-file-and-not-for-what-it-says.md)
landed alongside this one and decides something else about the same check: what
a verdict may rest on. The certificate is checked here; whether that check comes
out `Confirmed` or `SignatureOnly` is settled there, and a certificate whose copy
this system could not read is `SignatureOnly` like any other paper.

## Context

ADR-0035 cut the check from thirteen types to one. The reasoning was the
customer's own: a register extract's code is issued by the register, and
answering about it under the heading of the National Archive Fund told an
inspector that a second system exists rather than anything about the sheet in
hand. One paper, one authority, no second opinion.

That cut took one paper too many with it. The archival certificate's code is not
the register's and not a notary's: it is the archive's, printed on a sheet the
archive issued, and it resolves in the same `qr.esd.milliarxiv.gov.az` the
disposal order's does. ADR-0034 had noticed as much — the certificate in the
Hümbətov package is the one sheet of it whose code the reader could make out at
all, and it is the answer about that very sheet that this context's `verifyQr`
schema is documented against. ADR-0035's own narrowing rule, "the issuer of the
code is the authority this check is about", includes the certificate; the list it
wrote down did not.

The customer says so plainly (COMM-173):

> В документе "Архивная справка" так же может быть QR-код для сверки с нац
> архивом. Если он есть — то тоже сверять, так как это сделано для документа
> "Распоряжение (или выписка из распоряжения)", и тоже отображать результат
> сверки.

Under ADR-0035 such a sheet got no `ArchiveQrCheck` at all and fell back to
`IntegrationNotConnected` — the report saying the National Archive is not
connected about a paper whose own code had just been decoded off it.

## Decision

**Two types are checked by their QR code: `disposal_order` and
`archive_certificate`.** `isCheckedByItsQrCode` asks the type against a set of
two and still asks the schema, so a profile that stops printing `qr_code` on one
of them stops asking about one rather than asking with nothing. Every other type
is where ADR-0035 left it: the code is decoded off the symbol and published on
the paper, and nothing is asked about it.

A certificate whose code resolves anywhere other than
`qr.esd.milliarxiv.gov.az` gets `IssuerNotConnected`, and one with no code
decoded off it gets `NoQrCode` — the same five statuses, the same per-paper line,
and no new vocabulary. Nothing in the check, the stage, the report or the web is
conditional on the type: `lookupByQr` takes a reference and the detail page draws
`archiveQrCheck` wherever one is present, which is why this ADR is a set of types
and not a feature.

**The certificate's own words for two of the eight lines are read as those
lines.** A certificate prints its number as `certificate_no` and the person as
`owner_name`, so `ALSO_PRINTED_AS` carries both beside the disposal order's
`order_no` and `applicant_name`. It stays a reading of the same line off the same
sheet and never a value carried over from a sister paper, which ADR-0023 forbids:
a key is only ever read off the paper being asked about, and a type that does not
declare `certificate_no` has nothing under it to find.

**The three lines a certificate does not print stay `NotStated`.** Its schema
declares five of the eight — number, date, issuing body, owner, address — and
says nothing about the plot's area, the item of the Decree or the reference into
a fond. That is the same shape the disposal order already had, where two of the
eight are silent on both sides, and it is why `isHeldAgainstTheArchiveByQr` is
left alone: that predicate answers what a full Decree 439 comparison is _about_,
the certificate declares too few lines to be one, and the offline extractor —
its only caller — is right to go on saying so.

## Consequences

One more paper of every package gets a line of the report, and it is the paper
the customer opens: an inspector reading an archival certificate now sees whether
the archive's own copy of it agrees with the sheet in front of them, line by
line, instead of a sentence saying the archive is not connected.

The disposal order is untouched. Neither the aliases nor the set change anything
about a type that was already checked, and the archive is asked once per paper
whose code is resolved — a package carrying both papers makes two calls where it
made one, which is the cost of the second answer.

`QrCodeUnavailable` now speaks of both types, so the sentence it is built from
stopped naming the disposal order: "no paper of the package that prints a QR code
carries one". A package whose certificate prints a code and whose disposal order
does not is a package the line is not compiled for at all — a code was read off a
paper that is checked, so the step was not skipped — and the order's own absence
is told against the order, as ADR-0032 decided.

The offline stand-ins hold a third paper: the demo's archival certificate, keyed
by a code of its own and worded as the offline extractor reads the demo sheet,
down to the issuing body — a certificate is issued by the archive that keeps the
book and not by the executive authority whose act the book records. A run with
every provider on `mock` now produces a real, confirmed check for the certificate
instead of nothing.
