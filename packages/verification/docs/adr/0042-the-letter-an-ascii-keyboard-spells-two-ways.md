# The letter an ASCII keyboard spells two ways

Date: 2026-09-23. Status: accepted.

Amends the folding in `domain/services/value-agreement.service.ts`, which
[ADR-0028](./0028-a-decree-439-paper-is-held-against-the-archives-copy-by-its-qr-code.md)
holds a name, a body and an address against the archive's copy with, and which
the mock cross-checker and `verification-package.aggregate.ts` use for the same
purpose between two papers of one package.

## Context

The QR check was run against the live service on 2026-09-23 for the Hümbətov
package's code. It works: `verifyQr` answers in 0.7s, the presigned copy is a
two-page born-digital PDF read by its text layer, and the extraction stage reads
seven of the eight lines off it, the eighth being an item of Decree 439 the order
does not print. The number and the date both came back `Match`.

The holder did not. The archive's copy prints the name — in an oblique case and
surname-last, `vət. Yavər Kərim oğlu Hümbətova` — and the reader returned the
base form `Hümbətov Yavər Kərim oğlu`, which is the right answer. The package's
own sheet carries the same man as `Hümbətov Yaver Karim oğlu`. The comparison
answered `Mismatch`, and the check as a whole `Differs`: the archive's own copy
of the order reported as contradicting the order.

`ə` is why. It is a letter in its own right rather than a letter with a mark on
it, so decomposition does not reach it and it was folded to `e` by a table. But
whoever types an Azerbaijani name on an ASCII keyboard has two answers for it —
`e` for how it sounds, `a` for the Arabic name it came from — and both are in
ordinary use, often in one name: `Yavər` became `Yaver` and `Kərim` became
`Karim` on the same line of the same sheet. Folded to `e` alone, `karim` and
`kerim` are two words.

This is the failure [ADR-0038](./0038-the-archives-own-sheet-is-read-by-a-reader-and-a-fragment-never-accuses.md)
names as the worst this check has: an inspector told that the archive denies a
paper stops looking at it. The guard ADR-0038 put in — a reading that is not the
kind of thing the line holds reaches them as `NotStated` — does not catch this
one, because both sides read perfectly well as a name. They read as two names.

## Decision

**`ə` is read both ways, and only `ə` is.** A word carrying it has more than one
reading — `Kərim` is `kerim` and `karim` — and two words agree when any reading
of one continues any reading of the other. A word with no `ə` keeps the single
reading it has: reading every `e` as an `a` would make `Balayev` and `Belayev`
one surname, and they are two.

The alternative was a canonical form that collapses `a` and `e` everywhere, which
is one line instead of several. It buys the same agreement and pays for it with
every pair of names that differ by exactly that vowel, and a false `Match`
between two surnames is a paper confirmed against somebody else's record.

`tokensOf` still answers one canonical token per word, the plainest reading
first, because what it is for is naming what was compared and not comparing.
`ı`, the other letter decomposition does not reach, keeps its single fold to `i`.

**The readings are bounded.** A word of more than four `ə` is read the one way it
was read before this existed. No name on any paper has five; the bound is there
so that a reading cannot be made expensive by a value nobody meant.

## Consequences

The Hümbətov package's holder line reads `Match`, and the check `Confirmed`,
which is what the archive's copy says and what the paper says.

The same forgiveness now applies wherever two values off two papers are held
together — the cross-check between an identity card and an application, the
address and the body on the archive comparison — and in the same direction: more
pairs agree, none that agreed before stops agreeing. That direction is the safe
one here for the reason ADR-0038 gives, and it is bounded by the one letter.

An extractor that renders `ə` as something else again — a scan that reads it as
`о`, a font that maps it to a private-use code point — is still a mismatch, and
belongs in the reading rather than here.
