/**
 * The two figures the register counts with: a tally of classes that make a
 * whole, and a ranking of how often things happen.
 *
 * Both are built to the same three rules, which are what keep a chart in this
 * world from becoming the decorative dashboard the design system rules out:
 *
 *  - **Thin marks, no chrome.** A 10px rule of colour, a hairline track, no
 *    gridlines, no axis, no frame. The bar states a proportion; the numbers
 *    beside it state the values.
 *  - **The gap does the separating, never a border.** Touching classes are held
 *    apart by 2px of the page showing through, so a segment never needs a
 *    stroke of ink that isn't data.
 *  - **Every value is written out.** The bar is redundant with the list under
 *    it, which carries each class's name, count and share as text — so the
 *    figure is readable in grayscale, under any colour vision, and with no
 *    pointer, and nothing is hidden behind a hover. That is also why the bar is
 *    `aria-hidden`: a screen reader is given the list, which is the same answer
 *    without the geometry.
 */
import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';

/** One class of a tally, ready to draw: a fill class, a width, and its words. */
export type TallyMark = {
  id: string;
  /** The Tailwind background utility this class is drawn in. */
  fill: string;
  label: string;
  count: number;
  /** 0…1. What fraction of the whole this class is. */
  share: number;
  /** Drawn in the list in place of the dot, where the class has a glyph of its
   *  own. Five archive answers have five glyphs precisely so that none of them
   *  rests on its colour; a tally of them keeps that. */
  glyph?: ReactNode;
};

/** A share as a whole percent. Rounded for reading, never for arithmetic —
 *  nothing is computed from this, and the exact count sits beside it. */
export function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

/**
 * A proportional bar: one whole, divided into the classes it is made of.
 *
 * Classes at zero are left out of the bar and kept in the list beneath it. A
 * zero-width segment cannot be seen but its 2px gap can, so drawing them would
 * spend the bar's ink on classes that did not happen — and the list is where a
 * class at zero has to be stated anyway, in words rather than as an absence.
 *
 * A class that did happen never falls below 3px, however small its share. A
 * sliver rounded away to nothing would say "none" about a submission that
 * exists; the exact number is in the list, so the floor costs precision the
 * reader was never reading off the geometry.
 */
export function TallyBar({
  marks,
  empty,
  className,
}: {
  marks: readonly TallyMark[];
  /** What the track says when the tally counted nothing. */
  empty: string;
  className?: string;
}) {
  const drawn = marks.filter(mark => mark.count > 0);

  if (drawn.length === 0) {
    return (
      <div className={cn('flex items-center gap-2.5', className)}>
        <div
          aria-hidden
          className='register-hatch h-2.5 flex-1 rounded-full border border-rule'
        />
        <span className='shrink-0 text-[0.75rem] text-muted-foreground'>
          {empty}
        </span>
      </div>
    );
  }

  return (
    <div
      aria-hidden
      className={cn('flex h-2.5 w-full gap-[2px] overflow-hidden', className)}
    >
      {drawn.map(mark => (
        <span
          key={mark.id}
          // The proportion is carried by flex-grow and not by a width, so the
          // 2px gaps come out of the track before the shares divide what is
          // left. Widths that summed to 100% plus the gaps would overflow, and
          // the last class would be the one silently clipped.
          style={{ flex: `${mark.share} 1 0%` }}
          title={`${mark.label}: ${mark.count}`}
          className={cn(
            'h-full min-w-[3px] rounded-[2px] first:rounded-l-full last:rounded-r-full',
            mark.fill,
          )}
        />
      ))}
    </div>
  );
}

/**
 * The tally written out: every class, including the ones at zero.
 *
 * This is the figure's table view and its legend at once, which is why it is
 * always drawn rather than folded away — the colour above is a second reading
 * of it, not the only one. Each class carries its own mark, so identity never
 * rests on telling two fills apart.
 */
export function TallyList({
  marks,
  link,
  className,
}: {
  marks: readonly TallyMark[];
  /**
   * Wraps a row in whatever takes the reader to the submissions it counted.
   *
   * A render prop and not a URL, so this module stays a figure and knows
   * nothing about routes — and so the *caller* decides, per class, whether
   * there is an honest destination at all. Returning nothing leaves the row as
   * plain text, which is what a count with nowhere exact to lead must be: a
   * number that opens a different set of submissions than the one it counted is
   * worse than a number that opens nothing.
   */
  link?: (mark: TallyMark, row: ReactNode) => ReactNode;
  className?: string;
}) {
  return (
    <ul className={cn('flex flex-col', className)}>
      {marks.map(mark => {
        const row = (
          <>
            {mark.glyph ? (
              <span aria-hidden className='flex size-3 shrink-0 items-center'>
                {mark.glyph}
              </span>
            ) : (
              <span
                aria-hidden
                className={cn(
                  'size-2 shrink-0 rounded-full',
                  mark.fill,
                  // A class that did not happen keeps its place and loses its
                  // voice: still listed, so nobody reads its absence as "there
                  // is no such class", but not drawn as loudly as one that did.
                  mark.count === 0 && 'opacity-35',
                )}
              />
            )}
            <span
              className={cn(
                'min-w-0 text-[0.8125rem] leading-snug',
                mark.count === 0
                  ? 'text-muted-foreground'
                  : 'text-foreground/85',
              )}
            >
              {mark.label}
            </span>
            <span
              data-mono
              className={cn(
                'text-[0.8125rem] tabular-nums',
                mark.count === 0
                  ? 'text-muted-foreground/70'
                  : 'text-foreground',
              )}
            >
              {mark.count}
            </span>
            <span
              data-mono
              className='w-10 text-right text-[0.75rem] tabular-nums text-muted-foreground'
            >
              {percent(mark.share)}
            </span>
          </>
        );

        const grid =
          'grid grid-cols-[0.75rem_1fr_auto_auto] items-center gap-x-2 py-[3px]';
        const linked = link?.(
          mark,
          <span
            className={cn(
              grid,
              'rounded-sm px-1 -mx-1 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
            )}
          >
            {row}
          </span>,
        );

        return (
          <li key={mark.id} className={linked ? undefined : grid}>
            {linked ?? row}
          </li>
        );
      })}
    </ul>
  );
}

/** One row of a ranking: a thing that happened, and how often. */
export type RankMark = {
  id: string;
  label: string;
  count: number;
  /** 0…1 against the most frequent row, which is what the bar's length is. */
  share: number;
};

/**
 * A ranking: what came up most often, longest bar first.
 *
 * **No label is ever clipped, at any width.** Every name here is a sentence
 * fragment in three languages and two scripts, and a fixed label column would
 * truncate in whichever of them runs longest. So the rows are laid out two
 * ways: from `sm` up they share one subgrid whose first track is `max-content`,
 * which is as wide as the longest name and no wider — the bar takes what is
 * left and shrinks instead of the words. Below `sm`, where even that would
 * leave no bar worth drawing, the name takes a line of its own above it.
 *
 * Bars are measured against the most frequent row and not against a total,
 * because the question is which kinds come up most; measured against a total
 * nobody asked about, a tail of real findings would all draw as the same
 * sliver. The shortest bar still draws at 2%: a real finding must not round
 * away to nothing.
 */
export function RankBars({
  marks,
  fill,
  className,
}: {
  marks: readonly RankMark[];
  /** The Tailwind background utility every bar is drawn in. One hue for the
   *  whole ranking: these are one kind of thing counted, not several series,
   *  and colouring each row differently would spend the identity channel
   *  restating the length the reader can already see. */
  fill: string;
  className?: string;
}) {
  return (
    <ul
      className={cn(
        'flex flex-col gap-2.5',
        'sm:grid sm:grid-cols-[max-content_minmax(3rem,1fr)_auto] sm:items-center sm:gap-x-3 sm:gap-y-1.5',
        className,
      )}
    >
      {marks.map(mark => (
        <li
          key={mark.id}
          className='flex flex-col gap-1 sm:col-span-3 sm:grid sm:grid-cols-subgrid sm:gap-x-3 sm:gap-y-0'
        >
          <span className='min-w-0 text-[0.8125rem] leading-snug text-foreground/85'>
            {mark.label}
          </span>
          <span
            aria-hidden
            className='order-last h-1.5 w-full rounded-full bg-muted sm:order-none'
          >
            <span
              style={{ width: `${Math.max(mark.share * 100, 2)}%` }}
              className={cn('block h-full rounded-full', fill)}
            />
          </span>
          <span
            data-mono
            className='shrink-0 text-right text-[0.8125rem] tabular-nums text-foreground'
          >
            {mark.count}
          </span>
        </li>
      ))}
    </ul>
  );
}
