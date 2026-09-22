# One paper is checked by its QR code, and against the archive's own PDF

Date: 2026-09-22. Status: accepted.

Amends [ADR-0028](./0028-a-decree-439-paper-is-held-against-the-archives-copy-by-its-qr-code.md)
on what the paper is held against,
[ADR-0031](./0031-a-qr-check-with-no-code-to-check-is-skipped-and-said.md) and
[ADR-0034](./0034-a-qr-code-is-decoded-from-the-symbol-and-resolved-with-whoever-issued-it.md)
on which papers the check is made for. ADR-0032 is untouched and still decides
which of two absences is told.

## Context

ADR-0034 widened the check from the eleven Decree 439 titles to every type whose
schema declares `qr_code` — thirteen of them — so that a sheet with a code on its
face would get a line of the report about that code. The reasoning was sound and
the customer's answer to it is narrower than the question:

> Только из выписки распоряжения! И именно этот документ проверяется только
> через нац. архив (https://qr.esd.milliarxiv.gov.az) по ссылке из QR кода.
> Доп. сверху «с нашим архивом registry-stub» — не делаем.

One paper — the extract from the disposal order — one authority, and no second
opinion. That settles three things at once, and each of them is a decision this
context had made the other way.

It also names a capability that did not exist. The page a code opens has a
download button on it, «Sənədi yüklə», and behind it is the archive's own signed
copy of the paper:

> По ссылке из QR кода — там есть кнопка на скачивание PDF-файла. Его нужно
> оцифровать полностью и получить необходимые поля для сверки. Т.е. скачать и
> оцифровать если это pdf-картинка, а если pdf читается как текст — то не
> оцифровывать.

That file is the copy the paper in hand should be held against. Until now the
check asked `verifyQr`, which is a signature service and not a holdings service:
it answers who signed the electronic original and whether that signature
verifies, and says nothing at all about what the paper says. So ADR-0028's eight
lines came back eight times `NotStated`, and the guard added by ADR-0034 — an
answer stating nothing is `NotFound` and never `Confirmed` — was the only thing
standing between an inspector and a confirmation made out of silence.

## Decision

**One type is checked by its QR code: `disposal_order`.** `isCheckedByItsQrCode`
asks the type and the schema, not the schema alone. Every other type — the
register extract, the plan of the plot, the archive certificate, the rest of the
Decree 439 family — produces no `ArchiveQrCheck` at all and falls back to what it
said before its code was resolved: a paper this system sources from outside the
package and cannot ask about is `IntegrationNotConnected` again, which is where
ADR-0034 found it. The code itself is still decoded off the symbol and still
published on the paper, so an inspector can read it and follow it themselves.

A disposal order whose code resolves somewhere other than
`qr.esd.milliarxiv.gov.az` still gets `IssuerNotConnected`. That is the same
answer ADR-0034 gave, narrowed to the one sheet it is now made for.

**The verdict rests on the National Archive Fund alone.** The archive register —
`apps/registry-stub` behind `ArchiveRegistryPort` — is no longer asked whether it
holds a `Sərəncam çıxarışı` for the address, so no `RegistryDocument` for this
type reaches a `RegistryCheck` and no `RegistryDocumentMissing` is filed against
it. Two shelves answering about one sheet produced two grades of the same
evidence: a register that keeps no column for the paper read as a shortfall in
the package, and one that does read as corroboration the archive never gave. The
register still answers for the **property** — the address lookup and its
attributes, which is a different question and stays.

**The eight lines are read off the archive's own signed PDF.** `contentUrl` in
the `verifyQr` answer is followed inside the same call, while the link is live,
and the file it serves is digitised: a PDF with a real text layer is parsed, a
PDF that is a picture is rendered at `PDF_PAGE_DPI` and read by the pipeline's
own OCR provider. There is no second reader. The link itself is still never
stored — it expires in an hour and a saved link is dead by the time an inspector
clicks it; what is kept is what the file said.

Anything this can fail at leaves the answer it had before: no link, a link that
has expired, a file that is not a PDF, a renderer that will not open it, a reader
that refuses. The stage degrades to the metadata-only answer and is never thrown
over.

**The signature panel carries six lines, not five.** `certificateValidity` is
new — the certificate's validity period as the panel or the service words it,
never parsed into dates. An inspector is shown it beside the signer's name and
decides for themselves whether the signature was made inside it; turning two
words off a scan into a pair of instants would invent a precision the reading
never had. It is nullable everywhere, and a check stored before this restores as
`null`.

The panel is preferred for the five lines that are words, because it is what the
inspector is looking at and the service abbreviates. `valid` is the other way
round: the service computed it by checking the signature just now, and the sheet
prints what it was told when it was rendered.

## Consequences

The check says less about more papers and more about one. Twelve types lose a
line of the report; the sheet the customer actually opens gains a line-by-line
verdict instead of eight `NotStated`, which is the first time `Confirmed` on this
check has meant the archive's copy agrees with the paper.

The disposal order words two of the eight lines its own way — its document number
is `order_no` and the person it names is the `applicant_name` — so
`archiveQrQuestionOf` reads those keys as well. It is a reading of the same line
off the same sheet and not a value carried over from another paper, which
ADR-0023 still forbids.

`QrCodeUnavailable` now names the disposal order and nothing else, and says the
package carries no paper whose QR code this system resolves where it carries no
disposal order at all. A package whose plan of the plot prints a code and whose
disposal order does not is a package the line is compiled for: what matters is
the paper that would have been checked.

The archive's copies are fetched and rendered during a run, which makes the stage
slower and dependent on a second host. That is the cost of holding a paper
against a copy rather than against a signature, and it is bounded: one file per
disposal order, and every failure is an answer rather than a stop.

Rendered pages are written under a digest of the link, in `national-archive/`,
and never under the package: the same certified copy reached by two submissions
is one file, and a key naming the package would put the archive's paper where an
inspector downloading their own files would find it.
