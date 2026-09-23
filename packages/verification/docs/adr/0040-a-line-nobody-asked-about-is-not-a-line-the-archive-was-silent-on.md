# A line nobody asked about is not a line the archive was silent on

Date: 2026-09-23. Status: accepted.

Amends [ADR-0034](./0034-a-qr-code-is-decoded-from-the-symbol-and-resolved-with-whoever-issued-it.md),
which decided that the body issuing a paper is never read off a scan, and
[ADR-0028](./0028-a-decree-439-paper-is-held-against-the-archives-copy-by-its-qr-code.md),
which gave the comparison its eight lines and its three verdicts. It does not
reverse either: it says what ADR-0034's refusal has to look like on the page.

## Context

The detail page told an inspector: "the National Archive does not state:
Issuing authority, Decree item. These lines were not compared." Half of that
sentence is false.

`Decree item` is true. An extract from a disposal order does not print one and
the archive's entry for one carries none; the archive really is silent.

`Issuing authority` is not. The archive's signed PDF does print a body. We
decline to read it — `http-national-archive.adapter.ts` sets
`issuingAuthority: null` deliberately, because a body read off a scan is what
`issuingAuthorityCompetent` would be judged on, and one misread word would have
the check answer that the issuer had no power to make the act. That is our
decision about our own confidence, and the page reported it as the archive's
silence.

The customer read it the way the sentence reads and asked, reasonably, why there
is "nothing to judge its powers by". The answer — that we chose not to — was
nowhere on the screen, because the contract had nowhere to put it: both facts
arrive as `archiveValue: null` with `verdict: NotStated`, and no amount of
rewording the sentence can separate two states that are one value on the wire.

## Decision

**`NotCompared` is a fourth verdict, and it means the question was never put.**
`ArchiveQrFieldVerdict` gains it in the domain, in `@cadastre/api-contracts` and
in the database's enum. `documentValue` stays what was read off the paper;
`archiveValue` is null and is guarded to be null, because a line nobody asked
about cannot carry an answer. The line stays in `fields[]`: `guardEveryLineOnce`
is unchanged, and an inspector still sees all eight.

**Which lines those are is the answering service's fact, not the domain's.**
`ArchivedDocument.notCompared` is part of the port's answer and every adapter
states it: the HTTP adapter says `['issuing_authority']`, the offline stand-in —
which is a holdings stand-in and does supply an issuing body — says `[]`. The
domain reads it off `ArchivedPaper.notCompared` and has no list of its own. A
list in the domain would have said "the issuing authority is never compared",
which is not true of an archive with a holdings API; what is true is that _this_
service supplies no such line. It also keeps the distinction in the code rather
than in a field name: "the adapter does not supply it" and "the archive answered
nothing" are two different places in two different files.

**It weighs nothing.** `NotCompared` is not a mismatch, so it cannot make a
check `Differs` and it is not in `mismatched`. It is not evidence either: the
rule that an answer stating nothing is `NotFound` rather than a confirmation now
counts only `Match` and `Mismatch` as evidence, so eight lines nobody compared
can no longer be read as eight lines that agree. This is exactly where
`NotStated` already stood.

**Nothing is backfilled.** Rows written before today hold `NotStated` for
`issuing_authority`, and they keep it. Two reasons, and the second is decisive.
A stored check is the record of what the run decided when it ran, and rewriting
it puts a word in the mouth of a run that never said it. And SQL cannot tell the
two apart: a `NotStated` row with a null `archiveValue` is what the HTTP adapter
wrote _and_ what the offline stand-in writes for a paper whose own line was not
read, and the row does not say which adapter answered. A re-run of the package
produces the new verdict, which is already how a corrected package is checked
again (ADR-0033).

**`issuing_authority` stays `NotCompared` until the archive has a machine-
readable field for the issuing body.** Not until the reader gets better: the
whole of ADR-0034's argument is that no reading of a scan is good enough to
decide competence on, and a better reader does not change that. If the service
one day states the body as data, that line becomes an ordinary comparison and
the adapter drops it from `notCompared` — which is the shape this was given for.

## Consequences

`ArchiveQrFieldVerdictSchema` gains a member, so a client exhausting the verdict
has to name it. `apps/web`'s two maps over the verdict are exhaustive, so the
build carries it or does not compile: a tone (`silent`, as every other absence
is drawn) and a label in all three languages. That is the whole of what was done
to `apps/web` here — the maps completed and the dictionary filled, no layout and
no new component. How a line nobody asked about should be drawn, and what
sentence replaces the one the customer read, is the frontend's to decide.

`ArchivedDocument.notCompared` is required and not optional, so a new adapter
must say what it does not supply rather than inherit a default. An empty array
is the ordinary answer and costs one line.

A check made before today keeps reading back exactly as it was stored: nothing
in `restore` or the mapper had to change, because the column holds a string and
`NotStated` is still one of its values.
