/**
 * What the archive search answered, as a reader has to be able to take it in.
 *
 * The register answers with a number and never with a word: `confidence` is a
 * fact about two strings, and what it is worth is the reader's to decide
 * (ADR-0009). The four bands a person actually reads it in — High, Probable,
 * Possible, Weak — are the contract's own (`MATCH_BAND_FLOOR`, `bandOf`), and
 * they are *taken* from there rather than restated here on purpose: two screens
 * banding one answer differently would be two systems disagreeing about what
 * the register said. Nothing in this module invents a floor or a fifth band.
 *
 * What it does decide is the only thing a client may decide: which line of the
 * dictionary names a band, how full the meter beside it is drawn, and — the one
 * rule with teeth — that **silence is not a score**. A register that never kept
 * a cadastral number column says nothing about one; it does not say zero, and
 * it does not say "did not match". `readCriteria` splits the two so that no
 * screen has to remember to.
 */
import {
  MATCH_BAND_FLOOR,
  MATCH_BANDS,
  type ArchiveMatchDto,
  type MatchBand,
  type MatchedCriterionDto,
  type SearchCriterion,
} from '@cadastre/api-contracts/registry';

/** The band itself, in the reader's language. */
export const BAND_KEY: Record<MatchBand, string> = {
  High: 'search.band.high',
  Probable: 'search.band.probable',
  Possible: 'search.band.possible',
  Weak: 'search.band.weak',
};

/**
 * How many of the meter's four steps a band fills.
 *
 * An ordinal ramp drawn in ink and not in colour: the bands have an order, a
 * strength is not a disposition, and the surface's five outcome tones all say
 * something a confidence never says — that something is in order, at fault, or
 * waiting on somebody. The word stands beside the meter in every case (The
 * Status-Never-Alone Rule), so nothing here rests on the geometry either.
 *
 * `Weak` fills one step and not none: it is an answer the register offered, and
 * an empty meter would draw it as no answer at all.
 */
export const BAND_STEPS: Record<MatchBand, number> = {
  High: 4,
  Probable: 3,
  Possible: 2,
  Weak: 1,
};

/** The steps a meter is drawn with, weakest first. */
export const METER_STEPS = [1, 2, 3, 4] as const;

/**
 * The criterion the operator searched by, named as the record's own field.
 *
 * The same three lines of the dictionary the record's fields are printed under:
 * a criterion and the field it was graded against are one word (`SearchCriterion`),
 * and giving them two names on one screen would invent a distinction the
 * register does not make.
 */
export const CRITERION_KEY: Record<SearchCriterion, string> = {
  address: 'archive.field.address',
  ownerName: 'archive.field.owner_name',
  cadastralNumber: 'archive.field.cadastral_number',
};

/**
 * The thresholds the form offers, surest first.
 *
 * The contract's four floors and no others. An operator does not ask for "0.7";
 * they ask to be shown probable matches and better, which is the same number
 * under a word they can act on — and a slider with its own scale would be a
 * fifth opinion about where a band starts.
 */
export const THRESHOLD_CHOICES: readonly { band: MatchBand; floor: number }[] =
  MATCH_BANDS.map(band => ({ band, floor: MATCH_BAND_FLOOR[band] }));

/** One criterion the record could answer: a confidence, never null. */
export type AnsweredCriterion = MatchedCriterionDto & { confidence: number };

export type ReadCriteria = {
  /** Graded, in the order the register returned them. */
  answered: readonly AnsweredCriterion[];
  /** The record's own register keeps no such column, so it said nothing. */
  silent: readonly MatchedCriterionDto[];
};

/**
 * The criteria of one match, split into what the record answered and what it
 * was silent about.
 *
 * Kept apart because they are not the same news and a screen that mixed them
 * would report the archive's gaps as the record's failings. Silence is also
 * what the register left out of the match's own confidence — so the split here
 * is the reader's only way to see that the number in front of them is an
 * average over two criteria and not three.
 */
export function readCriteria(match: ArchiveMatchDto): ReadCriteria {
  return {
    answered: match.criteria.filter(
      (line): line is AnsweredCriterion => line.confidence !== null,
    ),
    silent: match.criteria.filter(line => line.confidence === null),
  };
}
