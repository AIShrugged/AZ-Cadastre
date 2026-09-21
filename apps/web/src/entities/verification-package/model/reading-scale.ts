/**
 * How sure a reading is, as a colour the case card prints it in.
 *
 * ─── Why this exists at all, and why only here ───────────────────────────────
 *
 * The register's standing rule is that a confidence is drawn **in ink and not
 * in colour**: the five disposition tones each say something a confidence never
 * says — that a thing is in order, at fault, or waiting on somebody — and a
 * weak reading is not a fault. `entities/archive-record/ui/match-marks.tsx`
 * states that rule and keeps to it, and the archive search still does: a
 * four-step neutral meter, ordinal, surviving grayscale, borrowing no meaning.
 *
 * The customer asked for the case card to say the same thing in colour, on
 * their own three thresholds (COMM-110). That is their call to make about their
 * own instrument, so the deviation is taken — and taken **narrowly**. It
 * applies to the case card and the checklist beside it, which is where an
 * inspector weighs one package's readings against each other; the archive
 * search keeps its ink meter, and the disposition palette is untouched. Hence a
 * scale of its own with its own tokens (`--reading-*`) rather than a second use
 * of the `ok` / `issues` / `failed` inks: borrowing those would be the screen
 * claiming a verdict about a reading, which is the very thing the ink rule
 * exists to prevent.
 *
 * ─── The thresholds, and the band they are not ───────────────────────────────
 *
 * These are **not** `CONFIDENCE_FLOOR`, and neither replaces the other. The
 * floor is the engine's own line — below 0.85 it files a finding and offers the
 * scan to be sent again — and it decides what is flagged, which this scale
 * never touches. This scale decides only what colour the figure is printed in.
 *
 * The two lines therefore disagree between 80% and 85%: a reading in that band
 * prints green and is still flagged as low. That is a genuine oddity and it is
 * the customer's to settle — the thresholds are theirs and the floor is the
 * engine's, so neither is moved here to make them meet (COMM-110).
 */

/** The three bands the customer asked the case card to read in. */
export type ReadingBand = 'low' | 'fair' | 'sure';

/**
 * Where each band starts, as the percentage a reader sees — 0 to 100, not 0
 * to 1.
 *
 * In the reader's own unit on purpose. The thresholds were given as "under
 * 60", "up to 79", "80 and over", and the figure on screen is what an inspector
 * checks them against; stating them as 0.6 and 0.8 here would leave the one
 * question this module exists to answer — does the colour match the number the
 * reader can see — to float over a rounding nobody wrote down.
 *
 * A reading belongs to the highest band whose floor it reaches.
 */
export const READING_BAND_FLOOR: Readonly<Record<ReadingBand, number>> = {
  sure: 80,
  fair: 60,
  low: 0,
};

/** The bands from the surest down, which is the order they are tested in. */
export const READING_BANDS: readonly ReadingBand[] = ['sure', 'fair', 'low'];

/**
 * The band a percentage falls in. 0–100, and anything below 60 is `low` —
 * including a reading nobody scored, which is 0.
 */
export function readingBand(percent: number): ReadingBand {
  return (
    READING_BANDS.find(band => percent >= READING_BAND_FLOOR[band]) ?? 'low'
  );
}

/**
 * The figure a reader sees for a confidence of 0..1.
 *
 * One function and not a `Math.round` at each call site, because `readReading`
 * bands what this returns: the colour and the number must be the same
 * statement. A confidence of 0.798 prints "80%", so it prints green — banding
 * the unrounded 79.8 instead would put a yellow 80% on the page, which reads as
 * the screen disagreeing with itself.
 */
export function readingPercent(confidence: number): number {
  return Math.round(confidence * 100);
}

/** A confidence of 0..1 as the reader sees it: the figure, and the band that
 *  figure falls in. */
export function readReading(confidence: number): {
  percent: number;
  band: ReadingBand;
} {
  const percent = readingPercent(confidence);
  return { percent, band: readingBand(percent) };
}
