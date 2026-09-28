# A signature vouches for the file and not for what it says

Date: 2026-09-28. Status: accepted.

Amends [ADR-0034](./0034-a-qr-code-is-decoded-from-the-symbol-and-resolved-with-whoever-issued-it.md)
and [ADR-0035](./0035-one-paper-is-checked-by-its-qr-code-and-against-the-archives-own-pdf.md)
on what counts as evidence for an Archive QR Check, and ADR-0035 again on how
the reading of the archive's own PDF chooses between its text layer and this
system's OCR. [ADR-0041](./0041-a-copy-we-could-not-read-is-not-an-archive-that-was-silent.md)
on when a check is worth making again is kept as it stands and now has a status
to key on.

## Context

On the customer's live case the archive certificate came back green — «Копия
Национального архива подтверждает», and under it the sentence "the National
Archive found its copy, every line held against it agrees". Not one of the eight
lines had been held against anything: the column «В копии Национального архива»
was empty down its whole length and every row read «архив не приводит».

The customer read the block exactly as it is written, and said what the block
means: the signature under the copy says the file arrived from the archive
unaltered; it says nothing about what is written on the file. So the report was
confirming contents it had never looked at — the one thing this check must never
do, and the thing [ADR-0034](./0034-a-qr-code-is-decoded-from-the-symbol-and-resolved-with-whoever-issued-it.md)
put a guard in `archiveQrCheckOf` to prevent:

```ts
const evidence =
  fields.some(f => f.verdict === 'Match' || f.verdict === 'Mismatch') ||
  archived.signature !== null;
```

The comment above it says the right thing. The second half of the condition
undoes it. The archive's electronic document service verifies a signature on
every answer it gives, so `signature !== null` holds whenever the archive
answered at all — and `found` was then reached with eight uncompared lines and
came out `Confirmed`, because `Confirmed` is what `found` produces when nothing
differs. Nothing differs over an empty set.

This is not a regression. It has been the behaviour since ADR-0034, and it is the
behaviour for the disposal order as much as for a certificate; what changed is
that a customer looked at a case where the comparison was empty.

The surface had already been patched for it. COMM-150 gave the block its own
word — «Сверена только подпись под копией» — derived on the client from
`status === 'Confirmed' && no compared line`. That covers the screen and nothing
else: the wire still carried `Confirmed`, the stored row still said `Confirmed`,
the findings against the package were still computed from `Confirmed`, and any
second reader of the contract — an export, a report, an integration — would read
a confirmation of the paper. A claim this wrong cannot live in a presenter.

Behind the empty comparison is a second question. Why did a copy that prints the
number, the date, the holder, the plot and the archive reference yield none of
them? `textLayerOf` decides whether a PDF is read exactly off its own text or
rendered and given to this system's OCR, and it decides on one number: the
characters in the layer, summed over the file, against a threshold of 200. A
searchable scan — a picture of the page with an invisible layer of some other
tool's OCR under it — clears that threshold easily, and a _shredded_ layer clears
it exactly as well as a good one: spaces inside words, diacritics dropped,
numbers broken apart. Length cannot tell them apart, so the file is declared
born-digital, this system's own OCR never runs, and the extractor is handed text
nothing can be read off.

(On the customer's own file the layer turns out to be clean: asked live on
2026-09-28, `verifyQr` serves the same 207 KB two-page PDF ADR-0041 describes and
`textLayerOf` returns both pages in full, the order's number, date, holder,
address, `0,06 ha` and `Fond-128, siy.1, iş-1043, vər.-69, 70, 72` all legible.
So this file is not the one that needs an OCR pass — but nothing in the code
knows the difference, and the next searchable scan with a worse layer fails
silently and identically.)

## Decision

**A verified signature is never evidence about what a paper says.** The
`archiveQrCheckOf` condition keeps its second half and loses its meaning: the
signature decides whether there is an answer worth publishing — a panel, and
eight lines the reader can see were not compared — and never whether the paper
is confirmed. With no signature and nothing compared there is nothing to publish
at all, and the caller is told that the way it is told about an empty shelf,
which is where ADR-0034 left it.

**A check that compared nothing has a status of its own: `SignatureOnly`.**
Derived in `ArchiveQrCheck.found` and never handed in, from the lines alone:
`Differs` where there is a finding — a signature that did not verify, a body
with no power to issue the paper — then `Confirmed` where a line was compared and
agreed, then `SignatureOnly`. Being derived is what makes a row written before
this decision read the new way the moment it is restored.

It behaves as the four absences do. `isUnanswered`, so the paper gets the
"not confirmed" line against its own entry and nothing is held against the
package: what is missing is the comparison, and a copy nobody compared accuses
nobody. `nothingWasCompared`, so `worthAskingAgain` is true and the next run asks
the archive again (ADR-0041). `NotFound` was rejected for it — the archive did
answer, did serve its copy and did sign it, and calling that "the fonds hold
nothing under this reference" is a second false statement in place of the first.

**The rows already written are backfilled.** The read model serves this status
out of its column without passing it through the domain, so a report made before
today would keep saying `Confirmed` until its package happened to be verified
again. One migration moves every `Confirmed` row with no `Match` or `Mismatch`
line to `SignatureOnly`. `Differs` rows are left alone.

**The surface keeps the words it already has** — `detail.qr.confirmed_no_line`
and its sentence — and takes them off the status instead of deriving the state
itself. Its own derivation stays as a fallback for a row written before the
migration ran, and its icon and silent tone are unchanged. Nothing about the
block's layout moves.

**One more sentence stops claiming what its table does not show.**
`confirmed_note` ended "and the body that issued the paper could issue one of
this kind", and on every paper this service answers about, competence was never
judged at all — the line beside the table says so in as many words (ADR-0040).
Where competence is unknown, the heading now says that instead of asserting it.

**A text layer is judged by what was read off it, not by how long it is.** The
choice in `textLayerOf` stays as it is, and a second chance is added after the
reading: where the copy was read from its text layer and the reader found none of
the eight lines, the same bytes are rendered and given to this system's OCR, and
the sheet is read again. The second answer is kept only if it states at least one
line; otherwise the first stands and the check reports exactly what it reported
before.

Judging the layer _before_ reading it was considered and rejected. The obvious
rule — a page almost entirely covered by a raster image is a scan, whatever its
layer says — would classify the customer's own file as a scan, throw away a text
layer that reads perfectly, and pay for an OCR pass over a file that needs none;
and there is no measurement of "shredded" that is not a guess. Whether a layer
was any good is knowable from one fact, and only after the fact: whether anything
was read off it. So the retry costs nothing on every file that works, and fires
only on a file that has already failed.

## Consequences

- A check with nothing compared can no longer be mistaken for a confirmation
  anywhere: the domain, the wire, the stored row and the screen all say the same
  thing, and a fourth reader of the contract inherits it.
- `ArchiveQrCheckStatus` has a seventh member, in the Prisma enum, the API
  contract and the web's three status dictionaries. A consumer that switches
  exhaustively on it is a compile error until it names the new one, which is the
  intended way to find them.
- An unconfirmed line is filed against every such paper where none was filed
  before — one sentence per paper, naming what the archive did and did not do.
- A searchable scan whose layer says nothing costs one render and one OCR pass
  more than it did. A born-digital file costs nothing more.
- The archive is asked again on the next run of a package whose check compared
  nothing, which was already true of the same rows before this decision.
