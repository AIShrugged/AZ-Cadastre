# The span is calculated off the axis chains, and the unit off the built-up area

Date: 2026-09-24. Status: accepted.

Amends how [ADR-0025](./0025-the-required-set-is-the-provision-of-article-8-the-case-falls-under.md)
establishes one of its six figures, the span. The other five are read as they
were.

## Context

Whether a house built from 2013 is registered under notification (8.0.10.2) or
needs a construction permit (8.0.10.1) turns on four conditions, one of them a
span of at most six metres. The span was read off the sketch design's
`span_dimensions` line, and `spanInMetres` took the largest length on it.

The customer's reference implementation (`reference_implementation (10).html`,
"Documents fields" → "Calculating the span length") and the worked sample that
came with it (`длина пролёта расчёт.pdf`, PROJE44's design for Novxanı bağ
massivi 3873D) say what a span is and how it is got, and the largest length on a
line is not it:

- A span is the distance between the centre axes of **adjacent** load-bearing
  structures (UPCC 3.0.48). It is neither the size of a room nor the overall
  width of the building.
- A room may cross an axis. On the sample the studio runs from axis A to axis
  C — 2400 + 5200 = 7600 — with axis B between them; the span is 5200.
- The overall width of any house exceeds six metres, so reading it would put
  every house under 8.0.10.1.
- The longest span is taken in each direction, and the larger compared with six
  metres.
- The unit cannot be told from the number of digits, nor trusted from the
  sheet: the sample's general notes say its dimensions are in centimetres, and
  every figure on its plans is millimetres. The overall lengths of the two axis
  chains multiplied together are the footprint, and the unit is the one that
  makes it the built-up area the technical and economic indicators state.

On the sample: 1—2 4000, 2—3 4400; A—B 2400, B—C 5200, C—D 2800, D—E 4000. Read
in millimetres, 8.4 × 14.4 = 121 m² against a stated 130.2 m² — the same
building, the difference being the outer walls beyond their axes. In
centimetres it is 12 096 m². The longest span is B—C, 5.2 m, and the design
falls under 8.0.10.2 on it.

## Decision

1. **The span is calculated, in the domain, by `spanCalculationOf`**
   (`domain/services/span.service.ts`). An entry is two axis marks of one chain
   — numerals, or capital letters in either script — and a length. An entry
   whose two axes have a third axis the value names on the same chain between
   them is set aside: it is a room or an overall dimension. The longest of each
   chain is kept, and the longer of the two is the figure the table is decided
   on.

2. **The unit of a bare figure is decided by the built-up area of the same
   paper**, where the paper states one: the unit — millimetres, centimetres or
   metres — whose footprint lies within a factor of 1.5 of it, the closest if
   more than one. The units are a hundred apart squared, so the band is wide
   without ever deciding wrongly. Where no area is stated or none fits, a bare
   figure of 100 or more is millimetres, as it was. A figure printed with a unit
   is in that unit.

3. **An axis the value never names cannot be known to be there.** "A—C 7600"
   stands as a span where nothing on the line mentions B. Leaving it out would
   lose the only span a design states; the extraction note is what keeps a room
   off the line in the first place.

4. **A value that names no two axes states no span.** It was first read the
   way it always had been — the largest length on it — and the first
   measurement (`eval/span`, ADR-0044) showed what that costs: a customer's set
   that dimensions rooms and marks no axes came back from the reader as
   "19400—23000 18600", which that rule made an 18.6 m span. A figure no two
   axes bound is a room, a wall or an overall dimension, and the rule says none
   of those is a span.

5. **The calculation travels with the figure.** `ParameterReading.calculation`
   carries every span of each chain in axis order, the unit and who decided it,
   and what was set aside; the contract carries it as
   `CaseParameterDto.calculation` — null for the other five figures and for a
   span nothing calculated, and never with an empty list of chains. The detail
   page states it
   three times: under the `span_dimensions` row it was read off, among the
   figures of the case, and on the case sheet — with whether it is within the
   six metres, read off the row of the table that holds it to them rather than
   compared in the client.

6. **The extraction note asks for the chain the calculation works on**: one
   entry per pair of adjacent axes, both directions, figures as printed and
   never converted, and neither the overall dimension nor a room — and null
   where no plan marks axes, which is most of the customer's own sets.

## Consequences

- A package whose design was read before this note changed carries whatever
  its reader returned then. The calculation still sets aside a room that
  crosses a named axis, so an old reading that listed every chain on the sheet
  gives the right span; one that listed only the overall dimension gives that
  dimension, as it did.
- The span is worked out off the sketch design and the approved design only,
  the two places the table names. A technical passport's inventory plan has no
  axes and dimensions rooms; it is not a source of the span, and a case that
  carries no design has no span — which is what the reference says: the
  operator enters it.
- The calculation is only as good as the chain it is given, and reading the
  chain off a drawing is not solved: the extractor pictures only the first six
  sheets, and the configured model misreads dimension chains. Measured on the
  sample and written down in `TECH_DEBT.md` §18; until it is fixed the chain
  shown beside the span is what an inspector checks and corrects.
