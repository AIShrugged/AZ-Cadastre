import { fold, tokenise } from './text.js';

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
