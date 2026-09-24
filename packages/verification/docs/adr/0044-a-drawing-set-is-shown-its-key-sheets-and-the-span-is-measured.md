# A drawing set is shown its key sheets, and how well the span is read is measured

Date: 2026-09-24. Status: accepted.

Follows [ADR-0043](./0043-the-span-is-calculated-off-the-axis-chains-and-the-unit-off-the-built-up-area.md),
which made the span a calculation and left open how well the chain it works on
is read (`TECH_DEBT.md` §18). Amends point 4 of ADR-0043 on the evidence
below.

## Context

The calculation is exact; the reading it is fed was not measured. Four
questions had been answered by hand, one ask at a time, and each answer moved
with the next ask: which sheets the extractor sees, which model reads them, what
the model is told, and what the calculation makes of what comes back.

Two facts came out of looking at the customer's own sets rather than the one
sample:

- **Most sets mark no axes.** Of the four design sets in the repository, only
  the reference implementation's sample (PROJE44) marks axes. The three
  customer sets — MAX CONSULTING twice, B.O ARCHITECTURE AND CONSTRUCTION once —
  dimension rooms and the outline and nothing else. The right answer for them
  is that no span can be calculated, and a reader that answers anything else
  has invented axes out of room sizes.
- **The pictures stopped before the plans.** The extractor attaches the first
  six sheets of a document as images. A set opens with a cover, general notes,
  a location plan and a site plan, so on the sample the pictures ended at the
  foundation plan and the reader took the site plan's turning points 1—5 for
  axes.

## Decision

1. **Measure before changing.** `packages/verification/eval/span/` holds the
   four sets' ground truth (`cases.json`, read off the drawings by hand) and a
   runner (`pnpm --filter @cadastre/verification eval:span`) that drives the
   production adapters — the PDF renderer, the OpenRouter OCR adapter, the
   OpenRouter extractor with the profile's own schema — and scores the span the
   domain calculates against the truth. Transcriptions are cached per OCR model
   and DPI; each extraction is asked `RUNS` times, because one answer of a
   routed model at temperature 0 is not its answer. Which sheets were shown as
   pictures is observed from what the extractor read out of the store, so the
   old rationing and the new one are measured by the same code.

2. **A type may name its key sheets, and they are pictured first.**
   `Declaration.keySheets` lists the headings of the sheets a reader has to see
   — for the three design types, the floor, foundation, basement and mansard
   plans and the table of indicators, in Azerbaijani and Russian.
   `sheetsToPicture` (`domain/services/document-hints.service.ts`) takes the
   sheets whose transcription carries one of them first and fills the rest of
   the six in page order, folding case and diacritics the way the classifier's
   headings are folded — the OCR read "BÜNÖVRƏNİN" as "BÜNOVRƏNİN", and that is
   the same heading. A type that names none keeps its first six sheets.

3. **The extraction note says what to answer when there are no axes**: null,
   never room sizes and never axes numbered by the reader.

4. **A value that names no two axes states no span** (ADR-0043 point 4, as
   amended). The first measurement is what showed it: a set with no axes came
   back as "19400—23000 18600", and reading the largest figure made that an
   18.6 m span.

## Measured

`qwen/qwen2.5-vl-72b-instruct` extracting, the same model transcribing, 300 dpi,
three asks per set. "Right" is the span the domain calculates — 5.2 m on the
sample, none on the other three.

|                                    | right     | invented axis pairs |
| ---------------------------------- | --------- | ------------------- |
| before, as scored then             | 1/12      | 49                  |
| before, scored under point 4       | 4/12      | 49                  |
| + key sheets pictured              | 6/12      | 135                 |
| + key sheets + the note on no axes | **10/12** | **0**               |

The three customer sets went from 4/9 to 9/9. The sample did not move: with the
right sheets in front of it the model read the chains right twice in nine
answered asks (two more were lost to a 429), and otherwise read the overall
dimensions or looped — axes 1 to 100, or A to Z, at 4000.

## Consequences

- The customer's sets now come back without a span, which is what the rule
  says of them, instead of a room read as one. The report still says the span
  could not be established, and the operator enters it.
- The one set that marks axes is not read reliably by the configured model.
  That is a model question and not a sheet question any more: the plans are in
  front of it. The same runner answers it for any candidate
  (`EXTRACTOR_MODEL=… pnpm … eval:span`); what was measured is in
  `docs/MODELS.md`, and the choice is left to whoever owns the model budget.
- Four sets are a small truth. A set that marks axes and is not the sample is
  the most useful thing to add to `cases.json`.
- The runner sends the customer's sheets to OpenRouter, which the pipeline does
  with them anyway. It is not to be pointed at a package that has not been
  cleared for that.
