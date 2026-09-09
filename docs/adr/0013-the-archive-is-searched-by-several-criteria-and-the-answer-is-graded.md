# The archive is searched by several criteria, and the answer is graded rather than decided

Date: 2026-09-09. Status: accepted.

Extends [ADR-0009](./0009-the-archive-register-behind-a-port.md), which put the
archive register behind a published contract and made it answer with facts and
never with a verdict, and
[ADR-0010](./0010-the-register-holds-its-records-in-its-own-database.md), which
says why one property is held twice by two offices.

## Context

The register published one question: `POST /addresses/lookup`. It takes an
address, resolves it to one record or refuses to choose, and checks the supplied
attributes — the owner's name, the parcel number — against the record it found.
That is the right shape for the caller it was built for: a verification stage
acts on what comes back, and a stage that acted on a guess would be guessing on
somebody's behalf.

It is the wrong shape for the other caller. An operator at the archive counter
has whatever the applicant brought: a name off a paper, half a parcel number off
a plan, an address written the way the applicant writes it. Three things are
missing for them, and each of the three is missing for the same reason — the
lookup resolves where a search has to offer.

- **A name and a parcel number are ways in, not things to check.** Today they
  can only be held against a record already found by address, so a case whose
  address nobody can spell cannot be found at all.
- **Agreement is a yes or a no.** `AttributeMatch` is `Matches | Differs |
NotRecorded`, so a name transliterated by hand out of the Cyrillic code page is
  a `Differs` — indistinguishable from a different person.
- **An answer does not say where it came from.** The archive is six registers
  kept by different offices over thirty years; they overlap, and where they
  overlap they contradict each other. The Hövsan handover registers do it by
  design: the same house is recorded twice, under two offices, with the holder
  of record changed between them.

## Decision

1. **A second area of the contract, `search`, beside `addresses` — not a wider
   lookup.** `ArchiveSearchApi`, answered at `POST /registry/search` and
   published through the gateway at this system's own origin. The two areas
   answer different questions for different callers, and keeping them apart is
   what lets the lookup stay unforgiving: a verification stage that acted on a
   0.6 match would be guessing, an operator reading a 0.6 match is doing their
   job.

2. **Any of three criteria, and at least one.** Address, right holder, cadastral
   number, alone or together. Several narrow rather than widen — a record is
   worth the average of the criteria it can answer — and a search with no
   criterion is refused, because it is a request for the whole archive and the
   archive is not a list.

3. **The answer is a number, 0 to 1, and never a word.** A number can be
   thresholded, sorted and compared between two answers. The four bands a person
   reads — High, Probable, Possible, Weak — are a vocabulary for whoever shows
   the answer, and the contract publishes the floors (`MATCH_BAND_FLOOR`) so
   that two screens cannot band one answer differently. Nothing on the wire
   carries a band.

4. **The threshold is in the request, with a default the contract names.** How
   much doubt is worth reading through depends on why somebody is searching, and
   the register does not know why — the same reason it does not know what four
   sources out of six means (ADR-0009). The default is the floor of `Possible`;
   an operator hunting a case they know is in there lowers it.

5. **The grading rules are the engine's, and they agree with the rules the
   lookup uses by construction.** `nameConfidence`, `referenceConfidence` and
   `addressConfidence` in `libs/matching-engine` return 1 for exactly the pairs
   `namesAgree`, `referencesAgree` and `addressesAgree` accept. A search that
   offered what the lookup refuses to resolve to would be a second, looser copy
   of the rule, which is what the engine exists to prevent (ADR-0009 §8).

6. **A silent field is silence, not a zero.** The registers disagree about which
   columns they carry, so a register that never had a cadastral number column
   says nothing about one. Silence is left out of the average and shown as such
   rather than scored, or a record's standing would depend on which columns its
   office kept in 1998 — the same reading `AttributeMatch.NotRecorded` already
   has on the lookup.

7. **Every record names the source it was read out of, and contradictions
   between sources are stated.** Records that answer to one address are grouped
   by that address, and where two _different_ sources say different things about
   the owner, the parcel number or the plot area, the response quotes both and
   flags both rows. It does not choose: which of the two is right is not the
   register's to say (ADR-0010), and somebody who can open the folder decides.
   The register number is deliberately not one of the contested fields — two of
   them for one case is the archive working as designed.

## Alternatives rejected

**Widening `AddressLookupRequest` instead of a second area.** One question
instead of two. It would have made the address optional on the request every
verification stage sends, put a threshold and a page size on a call that
resolves to a single record, and left `outcome: Found | NotFound | Ambiguous`
answering for a list. The stage would then have had to re-decide what an
`Ambiguous` with fourteen graded candidates means, which is the decision the
lookup exists to have already made.

**Returning the band instead of the number.** Easier to render and lossy in the
one direction that matters: two answers in the same band cannot be ordered, and
a caller that wants a stricter cut than the register's would have to un-decide a
word. The floors are published instead, which costs a client one function call
and keeps the ordering.

**Letting the source decide what a record is worth.** The port would then be
`search` rather than `findCandidates`, and every implementation of it — the
stand-in, an ingest, a real state register — would carry its own idea of how
close a name has to be. The source narrows; the grading happens once, above the
port.

**Choosing between two sources that disagree.** The newest, or the one whose
office is currently competent. Both are a verdict about somebody's title dressed
as a data-quality rule, and the register does not know enough to have one. It
says they differ and names both.
