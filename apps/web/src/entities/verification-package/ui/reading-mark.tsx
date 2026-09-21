/**
 * How the case card prints a reading's figure: tabular mono, on the customer's
 * three-band colour scale (`model/reading-scale`).
 *
 * Colour is never the whole statement here. The figure itself is always
 * printed — that is what a reader checks a threshold against, what survives
 * grayscale and colour-blindness, and what The Status-Never-Alone Rule asks for
 * — and each band carries its own type weight as well as its own ink, so the
 * three are told apart on a printed page too. The inks are an ordinal ramp: a
 * doubtful reading is the darkest and heaviest thing in the column on paper and
 * the lightest under the lamp, because presence flips with the ground.
 */
import { cn } from '@/shared/lib/cn';

import { readReading, type ReadingBand } from '../model/reading-scale';

/** The scale's own ink, never a disposition tone — see `model/reading-scale`. */
export const READING_INK: Record<ReadingBand, string> = {
  low: 'text-reading-low-ink',
  fair: 'text-reading-fair-ink',
  sure: 'text-reading-sure-ink',
};

/** The wash behind a figure that is given a chip of its own. */
export const READING_TINT: Record<ReadingBand, string> = {
  low: 'bg-reading-low/12',
  fair: 'bg-reading-fair/12',
  sure: 'bg-reading-sure/12',
};

/** The second carrier: weight, so the three bands survive a grayscale print
 *  and a reader who cannot tell the hues apart. */
export const READING_WEIGHT: Record<ReadingBand, string> = {
  low: 'font-semibold',
  fair: 'font-medium',
  sure: 'font-normal',
};

/** One reading, as a figure the scale has coloured. */
export function ReadingFigure({
  confidence,
  className,
}: {
  confidence: number;
  className?: string;
}) {
  const { percent, band } = readReading(confidence);

  return (
    <span
      data-mono
      className={cn(
        'tabular-nums',
        READING_INK[band],
        READING_WEIGHT[band],
        className,
      )}
    >
      {percent}%
    </span>
  );
}
