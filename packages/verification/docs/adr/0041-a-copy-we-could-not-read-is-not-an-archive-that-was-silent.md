# A copy we could not read is not an archive that was silent

Date: 2026-09-23. Status: accepted.

Amends [ADR-0035](./0035-one-paper-is-checked-by-its-qr-code-and-against-the-archives-own-pdf.md)
on what a failed reading of the archive's own PDF comes back as, and
[ADR-0040](./0040-a-line-nobody-asked-about-is-not-a-line-the-archive-was-silent-on.md)
on how many ways a line has of not having stood. [ADR-0037](./0037-an-archive-that-does-not-answer-is-a-state-of-its-own.md)
on when a paper is asked about again is widened.

## Context

On the customer's own package — the Hümbətov disposal order, стр. 32–34 — the
comparison came back with nothing. Seven of the eight lines read «Национальный
архив не приводит», the eighth read «Система не сверяет», and the check rested on
the signature alone while the report still summarised as confirmed. The customer
asked why the National Archive holds so little about the paper.

It does not hold little. Asked live on 2026-09-23 about the same code, the
service answers in under a second, serves a 207 KB two-page PDF with a real text
layer on it, and the extraction stage reads seven of the eight lines off that
text — the order's number, its date, the issuing body, the holder, the plot, the
address and the archive reference. The chain works. What the report showed was a
run in which some step of it did not, and there was no way to find out which:

- `contentUrl` missing from the answer, `digitise` coming back null for four
  different reasons, and the reader coming back empty all produced the same
  eight nulls;
- the digitiser logged one `debug` line carrying an error object, and the reader
  one `debug` line saying `stated: []`, so the stand's log at `info` said
  nothing at all about any of it;
- and the eight nulls then reached the inspector as the sentence "the archive
  states nothing", which is the archive's silence — a fact about the archive,
  standing in for a failure of ours.

The second half of it is worse than the first. `askTheArchive` skips a paper a
check was already made for, and `nobodyAnswered` — the one thing that makes a
later run ask again — is true only of `IssuerUnreachable`. A `Found` that read
none of the copy is "answered", so the stored check is final: the reading could
be fixed and the customer's package would stay empty for ever.

## Decision

**A line off a copy nobody could read is `NotRead`.** `ArchiveQrFieldVerdict`
gains a fifth verdict. `NotStated` stays what it has always been — one side or
the other prints no such value — and `NotCompared` stays a line nobody put a
question about (ADR-0040). `NotRead` is the third way of not having stood, and
it is the only one of the three that is a fault of ours: the archive answered,
served its copy, and this system could not read it. `documentValue` is still
what the paper says; `archiveValue` is guarded null, as it is for `NotCompared`.

It weighs nothing. Not a mismatch, not evidence, and it does not make the check
differ — the lines were never compared, and a verdict must not turn a failure of
ours into a finding against a valid paper (ADR-0038).

**Which line the answer carries is the answering adapter's fact.**
`ArchivedDocument.copyUnread` is a word from the step that failed, or null.
Null is the ordinary case and means a null among the eight lines is the copy not
printing that line. The domain asks only whether there was a reading at all;
which step failed is the log's and the note's.

**Every step of the chain leaves a line naming itself, at `warn`.** No link on
the answer (`NoLink`), no digitiser or no reader wired in (`NoDigitiser`,
`NoReader`), a link the archive refused (`LinkRefused`), a link that could not be
followed (`NotFetched`), a file the renderer will not open (`NotAPdf`), one too
long or empty (`TooLong`, `NoPages`), an OCR provider that refused
(`OcrRefused`), a file that read as nothing (`NothingPrinted`), a digitisation
with no sheets (`NoSheets`), a reader that refused (`ReaderRefused`). A reader
that looked and found none of the eight is not a failure — the copy may print
none of them — but it is logged at `warn` too, because the comparison it makes
is empty and empty is what somebody will be asking about.

**A check that compared nothing is asked again.** `worthAskingAgain` is
`nobodyAnswered` or `nothingWasCompared`: a `Confirmed` or `Differs` with no line
judged `Match` or `Mismatch`. Written as "nothing was compared" rather than "the
copy was not read" on purpose — rows stored by the builds that produced the
customer's report carry eight `NotStated` and are indistinguishable in SQL from a
copy that genuinely prints nothing, and it is those rows that have to be asked
again. Nothing is backfilled; the next run of the package writes the verdict.

Asking again costs one HTTP call and one reading, both of which the stage makes
anyway on a paper it has never asked about, and it is idempotent: a copy that
really does state none of the eight is asked again each run and answers the same.

## Consequences

A package whose comparison is empty now says whose fault that is, and the stand's
log names the step. An inspector reading `NotRead` is being told we could not
read the archive's copy — not that the archive keeps a sparse record — and the
lines that say so are on our side of the page.

Packages checked by a build that could not read the copy are re-asked on their
next run, which is how the customer's own package gets its seven lines. That is
the one behavioural change visible without reading a report: a stage that used
to skip every paper it had an answer for now re-asks the ones whose answer
established nothing.

`apps/web` has two exhaustive maps over the verdicts and a dictionary keyed by
them; a verdict they do not carry has no tone and no wording. Completing them is
COMM-150's, which owns this block's layout, and this ADR is the contract it
works to.

The archive's signature panel is unaffected and its mapping stands (COMM-151).
The service's own web client renders `org` under `organization.issuedCertificate`
— «Sertifikatı verən təşkilat» — and `expiredDate` under
`certificate.expiredDate` — «Sertifikatın etibarlılıq müddəti» — which is label
for label what this system publishes them as. `expiredDate` is absent from the
answer for this package, and the archive's own page prints `-` for it there too.
