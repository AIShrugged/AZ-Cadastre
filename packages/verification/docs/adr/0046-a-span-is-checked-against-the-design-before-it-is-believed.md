# A span is checked against the design before it is believed, and a check it fails establishes nothing

Date: 2026-09-25. Status: accepted.

Follows [ADR-0043](./0043-the-span-is-calculated-off-the-axis-chains-and-the-unit-off-the-built-up-area.md),
which made the span a calculation, and
[ADR-0044](./0044-a-drawing-set-is-shown-its-key-sheets-and-the-span-is-measured.md),
which measured how well the chain it works on is read and left the self-check
of that chain as the next step (`TECH_DEBT.md` §18). COMM-160.

## Context

A case was decided on production as `Determined 8.0.10.2` on a span of
**0.545 m**. The reading behind it, off sheet 22 of the Əliyeva Əsmər set:

```
span_dimensions = '1—2 360; 2—3 540; 3—4 375; 4—5 440; 5—6 545; 6—7 130;
                   7—8 375; 8—9 440; 9—10 545; 10—11 130'
built_up_area   = '10.8 x 16.1 = 174.48 m²'
```

The sheet marks no axes at all. It is a first-floor plan dimensioning rooms in
centimetres — the room areas printed on it prove the unit: 360 × 330 is the
11.9 m² the sheet prints, and as millimetres it would be 0.12 m². The only
circled marks on it are the ends of the section line "1-1". The reader numbered
the gaps between the rooms itself, and every layer below took the answer:

- **The unit.** `unitOf` decides a bare figure by the built-up area, but only
  when both chains carry a length. One chain, and the check never runs: the code
  falls through to "a bare figure of 100 or more is millimetres" and reports
  `Assumed`, which reads on screen as a decision and is a guess.
- **The area.** `squareMetresIn` took the first figure of
  `'10.8 x 16.1 = 174.48 m²'` — 10.8, a side of the building — as the footprint.
  It changed nothing here, because no check was asking, and it would have
  decided the unit of a two-chain reading wrongly and silently.
- **The result.** 54.5 cm between load-bearing structures is not a thing a
  building has. Nothing in the pipeline held the answer to being a length.

Each of the three was a check the code could have made against the design's own
figures and did not, and the case went out as decided rather than to an
inspector. That is the failure that matters: an empty figure is re-read by the
operator, and "0.545 m" is not.

## Decision

**A calculation states a span only if the reading passes every check.** The
checks, in the order the reading is put to them — the first failure is the one
reported, because the later checks stand on it:

1. **Both directions or nothing** (`OneChain`). A building is framed in two
   directions and a plan that marks axes marks them in both. One chain is half a
   reading, and it is the half that leaves the unit with nothing to check it
   against. `Assumed` on one chain is a guess on a reading that is already
   doubtful.
2. **A chain adds up to its own overall dimension** (`ChainUnlikeOverall`). The
   spacings of a chain sum to the total printed along it — 4000 + 4400 = 8400 on
   the sample design. The profile asks for those totals as a field of their own,
   `span_overall_dimensions`, because the overall dimension is exactly what
   `span_dimensions` must leave out. Ten per cent of slack: a set that prints the
   total over the outer faces rather than over the axes is a little longer (8800
   against 8400). A chain no total names is not checked — this is a check the
   design offers or does not.
3. **The two chains are the building** (`FootprintUnlikeArea`). Where the design
   states a built-up area and no unit makes the chains multiply to about it, the
   chain as read is not this building. This check existed; it now refuses rather
   than falling through to the millimetre rule.
4. **Something decided the unit** (`UnitUnchecked`). No unit printed beside the
   figures and no built-up area to hold them against means nothing knows what the
   figures are in.
5. **The answer is a length a span has** (`Implausible`): between 1.5 m and 30 m.

A refused calculation keeps its working — every chain, every spacing, the unit
and what was set aside — and states `longest: null` with `refusedFor` naming the
check. The parameter `span` is then unestablished: the table decides on five
figures, the case comes out `Ambiguous` between 8.0.10.1 and 8.0.10.2 where the
rest of the package would have decided it, and the screen says in words why
nothing was calculated, in the place the figure would have been.

**`squareMetresIn` reads the total a line works out and nothing else.** Where a
line carries `=`, the figure after it is the area. Where it only multiplies
sides — "10.8 x 16.1" — it states no area, and null is the honest answer.

**The extraction note says what an axis is not**: a circled mark at each end of a
cutting line ("1-1", "2-2", "A-A") labels a section drawing, a mark with no
dimension chain running along it is not an axis, and axes come in two directions
or the plan has none.

## Consequences

- The production case that prompted this establishes no span: `OneChain`, and
  the chain as read stays visible under the field with the reason beside it.
- The sample design (PROJE44) passes every check and still answers 5.2 m off
  axes B—C, with or without the overall dimensions — the regression minimum.
- A reading of two chains with no built-up area and no printed unit now refuses
  where it used to answer. That is deliberate: it was `Assumed`, which is a
  guess, and the operator can correct the chain by hand (ADR-0033) or the
  design's own indicators supply the area.
- `span_overall_dimensions` is a new field on the three design types. A design
  that does not print the totals answers null and refuses nothing; it is one
  more field a set can go unread on, which counts towards offering the document
  to be sent in again (`document-gaps.service.ts`), as every optional field does.
- The catch gemini needs is in place: its invented chain on the Vera set
  multiplies to about 45 m² against a stated 112 m², which is
  `FootprintUnlikeArea`. Choosing a drawing reader is now a question the eval can
  answer (`TECH_DEBT.md` §18).
- The checks are the domain's, so a chain typed in by an operator is held to
  them too.
