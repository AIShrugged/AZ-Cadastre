// The vocabulary the transcription stage writes and the stages after it read.
// It is one convention, declared once, so that a change to what the reader is
// asked to mark cannot drift from what the segmenter and the classifier look
// for.

// A sheet the reader found nothing on. It is not an unreadable sheet: the back
// of a stapled document is blank on purpose, and saying so lets the segmenter
// keep it with the sheet it belongs to instead of opening a document over it.
export const BLANK_PAGE = '[blank page]';

// A fragment the reader would not vouch for, e.g. `<?Rübabə>`.
const DOUBTFUL = /<\?([^>]*)>/g;

export function isBlank(text: string): boolean {
  return text.trim() === BLANK_PAGE;
}

// How many times a line may repeat before the repetition is the answer rather
// than the document. Three covers a form with genuinely identical rows.
const REPEATS_ALLOWED = 3;

// A runaway is only a runaway at scale: a handful of dropped lines is a table
// with blank rows in it, thousands are a model that stopped reading.
const RUNAWAY_LINES = 20;
const RUNAWAY_SHARE = 0.3;

// The same failure without the newlines, which is the form it actually took: a
// single line of 54,709 characters made of 3,910 words, two of them distinct.
// A line with that little to say for its length is not a row of a drawing's
// title block, it is a model going round.
const RUNAWAY_WORDS = 60;
const RUNAWAY_VARIETY = 0.1;
// How much of such a line is kept. Enough to see what it was before it went.
const RUNAWAY_KEPT = 200;

export type Transcription = {
  text: string;
  // The reader stopped transcribing and started repeating itself. Worth its own
  // flag because token certainties cannot see it: a line the model has already
  // written a hundred times is the most predictable thing it could write next,
  // so a page that looped comes back scored 0.99 — the confidence signal is not
  // merely silent about this failure, it endorses it.
  looped: boolean;
};

// A page of drawing dimensions that ended in eight hundred empty table rows is
// the case this exists for: fifty thousand characters, of which the first eight
// hundred were the document. The repetition is cut, and the page is marked so
// the score can be taken away from it.
export function readAsFarAsItGot(raw: string): Transcription {
  const lines = raw.split('\n');
  const kept: string[] = [];
  let previous: string | null = null;
  let running = 0;
  let dropped = 0;
  let wentRound = false;

  for (const line of lines) {
    const settled = line.trim();

    if (settled === previous) {
      running += 1;
      if (running >= REPEATS_ALLOWED) {
        dropped += 1;
        continue;
      }
    } else {
      previous = settled;
      running = 0;
    }

    if (wentRoundWithin(settled)) {
      wentRound = true;
      kept.push(`${line.slice(0, RUNAWAY_KEPT)} …`);
      continue;
    }

    kept.push(line);
  }

  const overLines =
    dropped >= RUNAWAY_LINES &&
    dropped / Math.max(lines.length, 1) >= RUNAWAY_SHARE;

  return { text: kept.join('\n').trim(), looped: overLines || wentRound };
}

// One line saying the same two words three thousand times.
function wentRoundWithin(line: string): boolean {
  const words = line.split(/\s+/).filter(Boolean);

  if (words.length < RUNAWAY_WORDS) return false;

  return new Set(words).size / words.length <= RUNAWAY_VARIETY;
}

// The share of the transcription the reader did not hedge, as a 0..1 figure.
// A page nobody hedged reads 1; a page half of which is wrapped in `<?…>` reads
// 0.5. It is a coarse measure and it is meant to be: its job is to notice the
// pages a reader struggled with, which on this material are the handwritten and
// the faint ones, and those are exactly the pages an inspector should look at
// themselves.
export function legibilityOf(text: string): number {
  if (isBlank(text)) return 1;

  const total = text.length;
  if (total === 0) return 0;

  let doubtful = 0;
  for (const match of text.matchAll(DOUBTFUL))
    doubtful += match[1]?.length ?? 0;

  return Math.max(0, Math.min(1, (total - doubtful) / total));
}

// The marks by which an office attests a paper: the seal it presses, whose
// legend the reader copies where it can make it out, and the hand that signed
// it, which is no text at all. Both are written by the transcription stage
// under the convention declared above, and this is where that convention is
// read back — a stamp is a finding of its own, not a word of the document.
//
// Optional colon and plural because the mark is written by a model: `[stamp]`
// and `[stamps: ARXİV]` are the same observation as `[stamp: ARXİV]`, and a
// seal missed on a spelling would be reported as a seal that is not there.
const STAMP = /\[stamps?(?::\s*([^\]]*))?\]/gi;
// Deliberately without `g`: a global regexp carries its own cursor, and a
// shared one answering `test` differently on the same text is a bug that only
// shows up on the second document.
const SIGNATURE = /\[signatures?\b[^\]]*\]/i;
// What the reader is asked to write inside a stamp it cannot make out.
const ILLEGIBLE = 'illegible';

export type Attestation = {
  // One entry per stamp on the text, in reading order, holding the legend the
  // reader made out. A stamp it could not read contributes an empty legend:
  // sealed but unreadable and not sealed at all are different answers about
  // the paper, and collapsing them would lose the one an inspector can act on.
  readonly stamps: readonly string[];
  readonly isSigned: boolean;
};

// What a transcription says about the marks on the sheets it covers. It says
// nothing about how much that is worth: a mark is only as certain as the
// reading of the sheet it was seen on, so the caller carries that sheet's
// confidence onto whatever it concludes (docs/process-overview.md §5).
export function attestationIn(text: string): Attestation {
  const stamps = [...text.matchAll(STAMP)].map(match => legendOf(match[1]));

  return { stamps, isSigned: SIGNATURE.test(text) };
}

function legendOf(raw: string | undefined): string {
  const settled = (raw ?? '').trim();

  return settled.toLowerCase() === ILLEGIBLE ? '' : settled;
}
