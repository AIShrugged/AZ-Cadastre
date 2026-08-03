# Models and confidence

Every reading this system reports carries a confidence, and PRD §4.6 makes that
number load-bearing: below `0.80` a reading goes to the inspector as a finding
instead of into the register as a fact. A number that cannot be obtained must
therefore not be invented — and for a while it was. This page records where the
number comes from, which models supply it, and how to check a model before
putting it in `OCR_MODEL` and its neighbours.

## Where the number comes from

Two independent accounts of the same certainty, and the **lower of the two** is
what gets recorded:

**Token logprobs.** With `logprobs: true`, a route returns the probability it
assigned to each token it generated; `exp(mean(logprob))` is the geometric mean
of those, i.e. how sure the model was of the characters it wrote. This is the
better signal because the model is not asked for it and cannot posture with it.

**The model's own account.** The segmenter, classifier and extractor answer in
JSON and are asked for a `confidence` alongside every answer; the transcription
stage is asked to wrap doubtful fragments as `<?text>`, and the share of the
page left unwrapped is its score. Coarse, but it works on routes that report no
logprobs at all, and it is the only per-_field_ signal available — one logprob
figure covers a whole response, so without it every field of a document would
share one number.

**A ceiling from the page it was read on.** No value is surer than the reading
it came from, so every extracted field is capped by the confidence of its own
sheet. The identity card is why: the sheet came back at 0.68, and the extractor
then reported its card number at 0.90 — with a digit wrong. The page knew;
nothing was asking it.

**A ceiling for a reader that ran away.** A model that stops transcribing and
starts repeating itself produces the highest-scoring output there is, because a
line it has already written a hundred times is the most predictable thing it
could write next. One drawing sheet came back as 54,569 characters — the
explication table, then eight hundred empty rows of it — at **0.994**. Logprobs
cannot see this failure; they reward it. So `transcription-marks.ts` cuts the
repetition, keeps what was read before it, and caps the page below the floor.

Where none of these is on offer the reading is recorded as **unscored** — stored as
`0`, which is below the floor, so it surfaces for review. This is deliberate.
The previous behaviour was a `NOMINAL_CONFIDENCE = 0.9` constant applied
whenever logprobs were absent, and because the model then configured never
returned any, every page, every classification and every field in the system
reported exactly 90 % — a garbled applicant name read off handwriting was
displayed at the same confidence as a printed certificate number, the
low-confidence section of the report could never fire, and the 0.80 threshold
was dead code.

## A third check, on the extractor only

Confidence says how sure the model was. It does not say whether the value was on
the paper. So every extracted field must come with a short literal quote from
the sheet's transcription, and `evidence.ts` checks that the quote is really
there — forgiving spacing, case, the several dashes a scan produces and the
transcription's own `[hw: …]` markers, but not forgiving invention.

A field whose quote does not check out is not thrown away: the extractor is sent
the page images too, so it may well have read the value off the scan. It is
capped below the confidence floor instead, which puts it in front of the
inspector. What this catches, on the reference package, is an archival
certificate dated 15.12.2025 returned as `15.12.2026`, and an applicant name of
`Strzela Ribaba` assembled out of the shape of some handwriting — both of which
the previous pipeline reported at 90 %.

## What routes actually answer

OpenRouter fans one model id out over several upstream providers, and
`supported_parameters` advertising `logprobs` says what the _model_ can do, not
what the _route_ will return. Of 338 models in the catalogue, 137 advertise
logprobs; far fewer deliver them. Three answers come back:

| answer                | what it looks like                       | what it is worth              |
| --------------------- | ---------------------------------------- | ----------------------------- |
| a real table          | one entry per generated token, varying   | the signal                    |
| a **stub**            | one entry standing in for a page of text | nothing — averages to ~1.00   |
| a **saturated** table | one entry per token, every logprob `0`   | nothing — always exactly 1.00 |

`confidenceFromLogprobs` refuses the last two (`logprob-confidence.ts`): a table
claiming fewer than one token per twelve characters of answer is a stub, and a
table of 32+ tokens that are all perfectly certain is a route reporting on
itself rather than on the reading.

### Measured, on the four hardest sheets of the reference package

Scored against values read off the originals by hand — a photocopied identity
card, a drawing title block, a handwritten plan-scheme, and a 1999 decree in
Cyrillic Azerbaijani — at 300 dpi.

| model                            | correct   | logprobs                                     | confidence seen |
| -------------------------------- | --------- | -------------------------------------------- | --------------- |
| **qwen/qwen2.5-vl-72b-instruct** | 26/31     | real, from every provider (Nebius, Parasail) | 0.64 – 0.94     |
| qwen/qwen3-vl-235b-a22b-instruct | **29/31** | stub (1 token) from Alibaba/Novita           | —               |
| x-ai/grok-4.5                    | 28/31     | saturated (all zero)                         | always 1.000    |
| google/gemini-2.5-flash          | 27/31     | none                                         | —               |
| openai/gpt-4o                    | 22/31     | real, every call (OpenAI, Azure)             | 0.76 – 0.93     |
| qwen/qwen3-vl-32b-instruct       | 23/31     | stub                                         | —               |

`qwen2.5-vl-72b` is the default because it is the most accurate of the models
that will tell us how accurate they were being. Qwen3-VL reads these documents
better and cannot be scored: pinning it to the one provider that returns real
logprobs (Parasail) hits upstream rate limits and degrades its answers, so it is
not a default — but if you do not need confidence on the OCR stage, it is the
better reader.

Note what the numbers do, not just their range: on the identity card — the sheet
every model got most wrong — `gpt-4o` returned **0.755**, below the floor. It
flagged the page it had in fact hallucinated its way through (inventing a card
number, an issue date and a place of birth). That is the mechanism working.

## Checking a model before you use it

Advertised support is not delivered support, and delivery varies by provider on
the same model id. Ask three times, because you may be answered by three
different providers:

```bash
for i in 1 2 3; do
  curl -s https://openrouter.ai/api/v1/chat/completions \
    -H "Authorization: Bearer $OPENROUTER_API_KEY" \
    -H 'Content-Type: application/json' \
    -d '{"model":"<candidate>","logprobs":true,"temperature":0,
         "messages":[{"role":"user","content":"Name three cities in Azerbaijan."}]}' \
  | python3 -c 'import json,sys,math
d=json.load(sys.stdin)
lp=(d.get("choices") or [{}])[0].get("logprobs",{}) or {}
c=lp.get("content") or []
n=len(c); chars=len((d["choices"][0]["message"]["content"] or ""))
zeros=sum(1 for t in c if t["logprob"]==0)
verdict=("NONE" if not n else "STUB" if chars>n*12 else "SATURATED" if zeros==n and n>=32 else "OK")
print(d.get("provider"), verdict, "tokens=%d chars=%d zeros=%d" % (n,chars,zeros),
      "conf=%.3f" % math.exp(sum(t["logprob"] for t in c)/n) if n else "")'
done
```

Three `OK`s from three different providers is the bar. Anything else means the
stage will fall back to self-reported confidence, which still works — the system
does not break — but it is a weaker signal and worth knowing you have chosen.

The extractor additionally sends page **images**, so `EXTRACTOR_MODEL` must
accept image input. `OCR_MODEL` obviously must.

## Resolution is part of the model choice

`PDF_PAGE_DPI` defaults to **300**, raised from 150. An identity card
photocopied onto A4 occupies about a quarter of the sheet; at 150 dpi its card
number is roughly 40 pixels wide, and every reader tested returned a plausible
invention rather than the number on the card. At 300 the same models read it.
The cost is upload bytes and seconds per page, and it buys the pages that matter
most — identity documents, handwritten annotations and drawing title blocks are
all small print on a large sheet.

## When a route does not answer at all

Every client sets an explicit `timeout` and `maxRetries: 1`. The SDK's defaults
are ten minutes and two retries, so a single sheet a provider never returns can
occupy a run for half an hour after it has read everything else — which is what
happened before these were set.

Above that, the OCR stage offers each sheet up to three times before the report
says it could not be read, and a sheet that is refused no longer ends the
reading of the file. A provider saying no to one page is not a provider saying
no: rate limits and timeouts have nothing to do with the sheet in hand, and the
second ask usually succeeds. One refused sheet in the middle of a twenty-six
page submission used to leave twenty of them unread, and the report then
described a package that was not the one submitted.

## Cost, roughly

For the 26-sheet reference package: 26 OCR calls, 1 segmentation call, ~11
classification calls, ~8 extraction calls (each carrying up to 6 page images).
At the defaults that is a few cents. `OCR_CONCURRENCY` trades wall-clock against
the provider's rate limits; 4 is comfortable.
