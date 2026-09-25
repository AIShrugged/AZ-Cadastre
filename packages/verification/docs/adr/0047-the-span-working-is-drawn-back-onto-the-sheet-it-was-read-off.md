# The span working is drawn back onto the sheet it was read off, and the drawing is what an inspector checks

Date: 2026-09-25. Status: accepted.

Follows [ADR-0043](./0043-the-span-is-calculated-off-the-axis-chains-and-the-unit-off-the-built-up-area.md),
which made the span a calculation,
[ADR-0044](./0044-a-drawing-set-is-shown-its-key-sheets-and-the-span-is-measured.md),
which chose the sheets it is read off and established that a set marking no axes
states no span, and
[ADR-0046](./0046-a-span-is-checked-against-the-design-before-it-is-believed.md),
which made the calculation check itself. COMM-165.

## Context

Everything the three ADRs above added is text. What reaches an inspector is a
number, a chain of axis pairs — `B—C 5200` — a unit, and, since ADR-0046,
sometimes a refusal. None of it can be held against the drawing on the desk.

The failure this is written for is ADR-0046's: a case decided in production on
`5—6 545`, off a sheet that marks no axes at all, where a reader had numbered the
gaps between rooms itself. ADR-0046 catches that reading now — but by arithmetic,
and the arithmetic is a second thing to be believed. Nobody could look at what
the system had read and see that axis 5 is not on the paper.

The self-check also cuts the other way. A refusal is an accusation against a
design, and `refusedFor: OneChain` on a set that genuinely marks one chain reads
exactly like `OneChain` on a set the reader read badly. The inspector has to open
thirteen sheets of a PDF to tell the two apart, and that is the work the system
exists to save.

## Decision

The run draws its own working onto a copy of the sheets it read, puts the copies
in the same object storage the rendered pages go into, and publishes a link per
sheet on the document.

**Geometry is read by a call of its own.** A new outbound port,
`SheetGeometryReader`, asks for the shapes on a sheet — room outlines with the
figure printed along each wall, the axes the set marks with the mark printed in
each circle, and the dimension segment between each adjacent pair — in
coordinates normalised to the sheet, 0..1 of its width and height. Not another
key of the extraction schema, for two measured reasons. The span is read off text
and that reading has been measured on four real designs (`eval/span`,
`docs/MODELS.md`); asking the same call for coordinates as well would invalidate
the measurement, because a longer answer is a different answer. And the model
that reads a dimension chain is not the model that reads a passport —
`qwen2.5-vl-72b` does not read a chain at all where `gemini-2.5-pro` reads the
reference set's exactly — while `EXTRACTOR_MODEL` is one setting for every type
of paper. So the reader has `GEOMETRY_PROVIDER` and `GEOMETRY_MODEL` of its own,
defaulting to `gemini-2.5-pro`.

ADR-0044's rule is restated to the geometry reader in its own words: a set that
marks no circled axes answers with no axes, never with gaps it numbered itself.
The rooms are still drawn — a picture of the rooms and no axes is precisely what
says the design states no span.

**What is drawn is decided in the domain.** `domain/services/span-markup.service.ts`
turns geometry into a plan: each room its own colour, its corners lettered
`A, B, C…` in outline order so its walls read `AB`, `BC`, `CD`, each wall
captioned with the figure printed along it, the axes named `a, b, c…` along their
own chains with a legend keying each back to the mark the draughtsman printed,
and a legend saying which sheet, which paper, and what unit the figures are in.
The renderer is handed that plan and decides nothing: a rule that can only be
exercised through a bitmap is a rule nobody tests.

**The unit is the calculation's, or none.** The lengths are labelled with the
unit `spanCalculationOf` decided and the basis it decided it on. Where nothing
decided one — a set that marks no axes states no span, so there is no calculation
— every length is labelled `ед.` and the contract carries null in both fields.
Never millimetres by default: a figure carrying a unit nobody established is what
makes a wrong span look checked, which is the whole of COMM-160.

**The markup lives on the document, not on the calculation.** The picture is
worth the most exactly when the calculation refused, and then there is no
calculation for it to hang on. `DocumentDto.spanMarkup` is non-null only on the
three types a span is read off — `sketch_project`, `approved_design`,
`architectural_planning_section` — decided by the schema declaring
`span_dimensions` rather than by a list of type keys, so a fourth type added to
the profile gets the markup with it.

**Nothing here can refuse a span.** The stage runs after extraction and touches
no reading. A sheet whose geometry came back empty, a canvas that failed, a PNG
that would not store — each costs its own picture and is said in the markup's
`notes`. The calculation is exactly what it would have been without the stage.

**Why the markup is short is said as reasons, not as a sentence.** `notes` is a
list of four possible words — `NoAxesOnSheets`, `NoRoomOutlines`,
`UnitUnestablished`, `SheetsUnmarked` — each with the number of sheets it is
about where it counts any, and empty where everything asked for is on the
pictures. It was first published as an English sentence the stage assembled, and
that sentence reached Russian and Azerbaijani screens in English (COMM-166,
COMM-170). The clauses were only ever four, which makes this the same closed
list `SpanCalculationDto.refusedFor` is, and the same rule: the server says
which case holds and the client says it in the reader's language. The one thing
the pictures keep in one language is the `ед.` printed on them, which is
graphics of the pipeline and not interface.

## Consequences

- An inspector opening a case can see the axes the span was measured between,
  drawn on the drawing, and can disagree with them. A refusal now comes with the
  evidence for it.
- A second model call per design set, with a second model to pay for. Measured
  live on 2026-09-25 at **$0.22 and 116–204 s per sheet** — six sheets of a set
  is around $1.30 and several minutes. The pictures are rationed the way the
  extractor's are: the type's key sheets first, six at most (`sheetsToPicture`),
  which is also what keeps the markup evidence for what the extractor saw.
- What the picture is good for is bounded by what the model is good at, and the
  two are not the same. On the reference set it placed every axis and every
  dimension segment on the drawing's own — `C—B 5200 mm` between the axes the
  span is actually measured between — and placed room outlines only
  approximately (`docs/MODELS.md`). That is the right way round: the span stands
  on the axes, and the rooms are orientation. Nothing drawn feeds the
  calculation, so a loose outline costs an inspector a glance and not a figure.
- The pictures are somebody's drawings, so their links are signed per request and
  expire, like a sheet's own. The storage key is never published.
- The image has to carry a font. `node:26-alpine` ships none, and a caption drawn
  in no font is a picture with nothing on it — `apps/server/Dockerfile` installs
  DejaVu and the renderer names it first in its font stack.
- The offline stand-in draws a fixed demo plan rather than running a domain rule,
  which is the first stand-in in this context that is not a comparison. There is
  no rule to run: where the rooms of a plan are on the paper cannot be worked out
  from a transcription of it, and a stand-in that laid them out by arithmetic
  would draw outlines on top of a drawing they have nothing to do with. It exists
  so the stage, the renderer, the key and the contract run with no API key.
