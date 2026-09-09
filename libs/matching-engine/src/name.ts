import { fold, tokenCoverage, tokenise } from './text.js';

// Endings an Azerbaijani form puts on a name that a register does not: the
// application is made *by* somebody, so the name arrives inflected. Stripped
// longest first, and never down to a stub — "Kavı qızına" and "Kavı qızı" are
// one person, "Ana" and "An" are not evidence of anything.
const CASE_ENDINGS: readonly string[] = [
  'nın',
  'nin',
  'nun',
  'nün',
  'ına',
  'inə',
  'una',
  'ünə',
  'dan',
  'dən',
  'na',
  'nə',
  'ya',
  'yə',
  'da',
  'də',
  'a',
  'ə',
  'ı',
  'i',
  'u',
  'ü',
];

const SHORTEST_STEM = 3;

function stem(token: string): string {
  const folded = fold(token);

  for (const ending of CASE_ENDINGS) {
    const cut = folded.length - fold(ending).length;

    if (cut >= SHORTEST_STEM && folded.endsWith(fold(ending))) {
      return folded.slice(0, cut);
    }
  }

  return folded;
}

/**
 * Whether two names denote the same person.
 *
 * Word order, capitalisation, script and an Azerbaijani case ending are
 * spelling. A patronymic one document carries and the other omits is spelling
 * too, so the shorter name only has to be contained in the longer one — but it
 * has to be the whole of the shorter name, and a name given as one word is not
 * enough to identify anybody.
 */
export function namesAgree(left: string, right: string): boolean {
  const first = tokenise(left).map(stem);
  const second = tokenise(right).map(stem);

  if (first.length < 2 || second.length < 2) return false;

  const [shorter, longer] =
    first.length <= second.length ? [first, second] : [second, first];

  return shorter.every(token => longer.includes(token));
}

/**
 * A name given as one word — a surname on its own — is worth this much of a
 * match and never more.
 *
 * `namesAgree` refuses it outright, and for a lookup that is right: a lookup
 * acts on the record it resolves to, and half the district shares a surname. A
 * search does not act, it offers, so `Əliyeva` typed alone is answered rather
 * than refused — but it is answered as the weak evidence it is, and the operator
 * is the one who reads the rest of the row.
 */
const LONE_TOKEN = 0.5;

/**
 * How far two names are from denoting the same person, as a number rather than
 * as a yes.
 *
 * The graded form of `namesAgree`, and it agrees with it by construction: a
 * pair that rule accepts is 1 here, whatever the spelling, the word order, the
 * script or the case ending. What this adds is the answer for the pairs it
 * refuses — a name typed with a letter wrong, a name transliterated out of the
 * Cyrillic code page by hand, a surname on its own — because a search must be
 * able to offer them and a lookup must not act on them.
 *
 * Word by word, and each word must be recognisably the same word (`SAME_WORD`)
 * or it counts for nothing. Anything looser reads a shared `qızı` and a shared
 * vowel as half a person.
 */
export function nameConfidence(left: string, right: string): number {
  if (namesAgree(left, right)) return 1;

  const first = tokenise(left).map(stem);
  const second = tokenise(right).map(stem);

  if (first.length === 0 || second.length === 0) return 0;

  const [shorter, longer] =
    first.length <= second.length ? [first, second] : [second, first];
  const covered = tokenCoverage(shorter, longer);

  return first.length < 2 || second.length < 2 ? covered * LONE_TOKEN : covered;
}
