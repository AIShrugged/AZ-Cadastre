import { z } from 'zod';

/**
 * How sure the register is that a record answers the search, as a word.
 *
 * The register itself never says one. It answers with a number — `confidence`,
 * 0 to 1 — because that is what it computed, and a number can be thresholded,
 * sorted and compared between two answers; a word cannot. The bands exist
 * because a person reading a list of records cannot read fourteen decimals, and
 * they are published here so that every reader draws the same four bands at the
 * same four places rather than each inventing its own.
 *
 * So this is a vocabulary for the caller and not a field on the wire. Nothing
 * in the response carries a band.
 */
export const MatchBandSchema = z.enum([
  'High',
  'Probable',
  'Possible',
  // Everything above zero that clears the threshold the caller asked with.
  // Offered rather than hidden: the register's coverage is partial and
  // historical, and a weak answer to a search is still the only answer there
  // is (ADR-0009).
  'Weak',
]);
export type MatchBand = z.infer<typeof MatchBandSchema>;

/**
 * Where each band starts. A confidence belongs to the highest band whose floor
 * it reaches.
 *
 * The numbers are the register's own reading of its own scale — 1 is the rule
 * agreeing outright, and the three below it are where a name transliterated by
 * hand, a number typed as far as it is known and a street with a different
 * house on it actually land (`libs/matching-engine`). They are published so a
 * client bands the same answer the same way; they are not a rule about
 * submissions, and nothing here says what any band is worth.
 */
export const MATCH_BAND_FLOOR: Readonly<Record<MatchBand, number>> = {
  High: 0.85,
  Probable: 0.7,
  Possible: 0.5,
  Weak: 0,
};

/** The bands from the strongest down, which is the order they are read in. */
export const MATCH_BANDS: readonly MatchBand[] = [
  'High',
  'Probable',
  'Possible',
  'Weak',
];

/**
 * The band a confidence falls in.
 *
 * Published beside the floors rather than left to each caller, for the reason
 * the floors are published at all: two screens banding one answer differently
 * is two systems disagreeing about what the register said.
 */
export function bandOf(confidence: number): MatchBand {
  return (
    MATCH_BANDS.find(band => confidence >= MATCH_BAND_FLOOR[band]) ?? 'Weak'
  );
}
