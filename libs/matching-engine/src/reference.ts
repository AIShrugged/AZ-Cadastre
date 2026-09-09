import { fold, similarity } from './text.js';

/**
 * Whether two strings are the same reference number — a cadastral number, a
 * certificate number, an identity document number.
 *
 * Spacing, hyphens, slashes and a series prefix written apart from the digits
 * are formatting. A different character in the skeleton is a different
 * reference: this is the one comparison in the engine that forgives nothing
 * beyond punctuation.
 */
export function referencesAgree(left: string, right: string): boolean {
  const first = skeleton(left);
  const second = skeleton(right);

  return first.length > 0 && first === second;
}

/** The reference with everything that is only formatting taken out of it. */
function skeleton(raw: string): string {
  return fold(raw).replaceAll(/[^a-z0-9]/gu, '');
}

/**
 * The most a reference number that is merely *close* can be worth.
 *
 * A cadastral number is not prose: one character apart is a different parcel,
 * not a different spelling of the same one. So a near miss is stated as a near
 * miss and can never read as a match — it is offered because a digit is the
 * easiest thing in the world to mistype, not because the register agrees.
 */
const NEAR_MISS = 0.8;

/**
 * How far two strings are from being the same reference number, as a number.
 *
 * The graded form of `referencesAgree`, and it is the least forgiving of the
 * three: the yes it grades is exact, and everything below it is one of two
 * things.
 *
 * A number typed as far as the operator has it — `40-12-345` against
 * `40-12-345-67` — is worth how much of it was given, because that is precisely
 * what is known. Anything else is a near miss, and it falls away twice as fast
 * as the difference grows: two references that share less than half their
 * characters are worth nothing, and one wrong digit in eleven is offered as a
 * possibility rather than as the parcel.
 */
export function referenceConfidence(left: string, right: string): number {
  const first = skeleton(left);
  const second = skeleton(right);

  if (first.length === 0 || second.length === 0) return 0;
  if (first === second) return 1;

  const [shorter, longer] =
    first.length <= second.length ? [first, second] : [second, first];

  if (longer.startsWith(shorter)) return shorter.length / longer.length;

  return Math.max(0, 2 * similarity(first, second) - 1) * NEAR_MISS;
}
