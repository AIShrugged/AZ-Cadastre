/**
 * Which values the card marks as handwritten.
 *
 * The reader marks handwriting in the transcription itself — `[hw: …]` around
 * what was written by hand — and the field DTOs stay neutral about it, so the
 * card derives the provenance from the source it already shows rather than
 * asking the HTTP edge for another classification of a reading.
 *
 * That makes the mark a text match, and a text match needs two rules to be
 * worth trusting. A value that was never read off the paper cannot carry the
 * mark at all, however its characters happen to fall; and a fragment matched
 * inside a longer value has to be enough of that value to be saying something
 * about it.
 */
import type { FieldDto } from '@cadastre/api-contracts/verification';

const HANDWRITTEN_FRAGMENT = /\[hw:\s*([^\]]+?)\s*\]/giu;

/**
 * The fields a machine decoded off the sheet instead of reading off it.
 *
 * Today that is the one `qr_code` line: the extractor's reading of it is
 * thrown away and the value is decoded from the QR symbol itself (ADR-0034),
 * which is why it comes back at confidence 1. Such a value has three states —
 * decoded, present but not decodable, absent — and none of them is
 * handwriting: the characters never passed through the transcription, so
 * nothing in the transcription can be evidence about them.
 */
const DECODED_FIELDS: ReadonlySet<string> = new Set(['qr_code']);

/** Whether this value came from a decoder rather than from the reading of the
 *  page, and so carries none of the marks a reading carries. */
export function isMachineDecoded(field: FieldDto): boolean {
  return DECODED_FIELDS.has(field.name);
}

/** Shorter than this a marked fragment matches by accident: every sheet holds
 *  a hand-written "12" or "2019", and finding those characters somewhere
 *  inside a longer value says nothing about how that value was written. */
const MIN_FRAGMENT = 4;

/** And how much of the value the fragment has to account for before the value
 *  is called handwritten: a value is marked when it was written by hand, not
 *  when a corner of it was. Half is what separates "Nizami 12" inside "Baku,
 *  Nizami 12" from a year inside a URL. */
const MIN_SHARE = 0.5;

function normalise(text: string): string {
  return text
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Whether the transcription says this field's value was written by hand. */
export function isHandwritten(field: FieldDto, sourceText: string): boolean {
  if (isMachineDecoded(field)) return false;

  const needle = normalise(field.value);
  if (needle.length < 2) return false;

  return [...sourceText.matchAll(HANDWRITTEN_FRAGMENT)].some(match => {
    const marked = normalise(match[1] ?? '');
    if (marked.length === 0) return false;

    // The honest case, untouched: a value handwritten into a printed form is
    // the value, and the reader may well have marked the whole phrase it sits
    // in. Anything the mark covers end to end is handwritten.
    if (marked.includes(needle)) return true;

    // The other way round the fragment is only part of the value, so it has to
    // be a substantial part of it to be evidence about the whole.
    return (
      needle.includes(marked) &&
      marked.length >= MIN_FRAGMENT &&
      marked.length / needle.length >= MIN_SHARE
    );
  });
}
