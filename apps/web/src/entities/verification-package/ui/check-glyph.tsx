/**
 * The mark a checked thing wears — one vocabulary for every surface that draws
 * a `ChecklistRow`.
 *
 * Five marks and five tints, defined once: the office reads them down the case
 * rail and the person who filed reads the same marks in their cabinet, and a
 * paper marked missing in one place must not be a different glyph or a
 * different ink in the other. The word beside a mark is the surface's to choose
 * — the two speak to different readers — but the mark itself is not
 * (The Status-Never-Alone Rule: a mark never travels without its word).
 */
import {
  CheckIcon,
  CircleDashedIcon,
  CircleHelpIcon,
  MinusIcon,
  TriangleAlertIcon,
} from 'lucide-react';

import { cn } from '@/shared/lib/cn';

import type { CheckMark } from '../model/checklist';

export const MARK_ICON: Record<CheckMark, typeof CheckIcon> = {
  ok: CheckIcon,
  short: MinusIcon,
  against: TriangleAlertIcon,
  open: CircleHelpIcon,
  quiet: CircleDashedIcon,
};

// The same tints the provision table draws its glyphs in, so a paper marked
// missing in the rail and in the table beside it is one mark.
export const MARK_TINT: Record<CheckMark, string> = {
  ok: 'bg-ok/12 text-ok-ink',
  short: 'bg-incomplete/12 text-incomplete-ink',
  against: 'bg-issues/14 text-issues-ink',
  open: 'bg-issues/14 text-issues-ink',
  quiet: 'bg-muted text-muted-foreground',
};

export const MARK_INK: Record<CheckMark, string> = {
  ok: 'text-ok-ink',
  short: 'text-incomplete-ink',
  against: 'text-issues-ink',
  open: 'text-issues-ink',
  quiet: 'text-muted-foreground',
};

/** `row` sits against a line of text; `tight` rides beside a tally, where a
 *  bare glyph read as a dash in front of the number. */
export type GlyphSize = 'row' | 'tight';

const DISC: Record<GlyphSize, string> = {
  row: 'size-[1.125rem]',
  tight: 'size-3.5',
};

const GLYPH: Record<GlyphSize, string> = {
  row: 'size-[0.6875rem]',
  tight: 'size-2.5',
};

const STROKE: Record<GlyphSize, number> = { row: 2.75, tight: 3 };

export function CheckGlyph({
  mark,
  size = 'row',
  className,
}: {
  mark: CheckMark;
  size?: GlyphSize;
  className?: string;
}) {
  const Icon = MARK_ICON[mark];
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-full',
        DISC[size],
        MARK_TINT[mark],
        className,
      )}
    >
      <Icon className={GLYPH[size]} strokeWidth={STROKE[size]} />
    </span>
  );
}
