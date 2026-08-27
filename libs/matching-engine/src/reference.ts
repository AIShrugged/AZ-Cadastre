import { fold } from './text.js';

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
  const skeleton = (raw: string): string =>
    fold(raw).replaceAll(/[^a-z0-9]/gu, '');

  const first = skeleton(left);
  const second = skeleton(right);

  return first.length > 0 && first === second;
}
