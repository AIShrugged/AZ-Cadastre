import { z } from 'zod';

/**
 * What was seen of one of the marks an office attests a paper with — the seal
 * it presses and the hand that signs it (COMM-76, ADR-0012).
 *
 * Four answers and not a boolean, because an inspector acts on the difference
 * between them and only two of them are about the paper at all. Until this
 * existed the response carried a finding when a mark the profile expects was
 * missing and nothing at all otherwise, which made "sealed", "not sealed" and
 * "nobody read the sheet" look the same on screen: empty.
 */
export const MarkStateSchema = z.enum([
  // Seen: a seal whose legend was made out, or a signature.
  'Present',
  // Seals were seen and not one of their legends could be read. Only ever a
  // seal's answer — a signature is no text at all, so there is nothing about it
  // to fail to read.
  'Illegible',
  // The sheets were read and carry no such mark.
  'Absent',
  // No sheet of the document was read, so nothing was looked at. Not `Absent`:
  // saying the mark is missing from a page nobody read would be a claim about
  // the reading dressed up as a claim about the document.
  'Unread',
]);
export type MarkState = z.infer<typeof MarkStateSchema>;
