// Whether a model's quotation is really in the text it claims to be quoting.
//
// The check is cheap and it is the only thing standing between the register and
// a value that reads perfectly and was never on the paper: an issue date of
// 2026 on a certificate dated 2025, a name assembled out of the shape of some
// handwriting. A model that must quote its source before its answer is trusted
// is a model that has to have found one.
//
// Matching is deliberately forgiving of everything that is not the content: a
// quote is normally re-typed rather than copied, so spacing, case, the several
// dashes and apostrophes a scan can produce, and the transcription's own
// bracketed marks are all levelled first. What survives is the characters that
// carry the meaning.

// `[hw: 15]` and `[stamp: ARXİV]` wrap text that is on the document — the
// bracket says how it got there, not that it is ours — so the wrapper goes and
// the words stay. A value handwritten into a printed form is the value.
const WRAPPED = /\[(?:hw|stamp):\s*([^\]]*)\]/gi;
// These stand for something that has no text at all, and leaving their names in
// would let a model "quote" the word signature.
const MARKS = /\[(?:signature|photo|qr|barcode|blank page)[^\]]*\]/gi;
const DOUBTFUL = /<\?([^>]*)>/g;
const DASHES = /[‐-―−]/g;
const QUOTES = /[‘’‛′“”″]/g;

// Shorter than this a "quote" stops being evidence of anything: every document
// contains "1", and a match on it says nothing about where a value came from.
const MIN_QUOTE = 4;

function flatten(text: string): string {
  return text
    .replace(WRAPPED, "$1")
    .replace(MARKS, " ")
    .replace(DOUBTFUL, "$1")
    .replace(DASHES, "-")
    .replace(QUOTES, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("az-AZ");
}

export function quotedIn(source: string, quote: string): boolean {
  const needle = flatten(quote);
  if (needle.length < MIN_QUOTE) return false;

  return flatten(source).includes(needle);
}
