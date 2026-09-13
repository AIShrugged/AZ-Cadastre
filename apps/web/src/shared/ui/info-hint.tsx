/**
 * An explanation one tap away instead of always in view.
 *
 * The surfaces that use it carry sentences an inspector needs once — what a
 * figure is a total of, why a declaration is kept apart from a reading, what
 * adding a file does to a report — and printing them under every heading on
 * every visit is what turned those pages into walls of text. The words are
 * unchanged; they moved behind the ⓘ beside the thing they explain, which
 * keyboard focus opens as well as a pointer.
 *
 * The label is taken rather than translated here, so the shared layer stays
 * free of the dictionary.
 */
import { InfoIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';

export function InfoHint({
  label,
  children,
  className,
}: {
  /** What the button is called to a screen reader. */
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={label}
        className={cn(
          'inline-grid size-6 shrink-0 place-items-center rounded-md align-middle text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50',
          className,
        )}
      >
        <InfoIcon aria-hidden className='size-3.5' />
      </TooltipTrigger>
      <TooltipContent className='max-w-80 flex-col items-start gap-1.5 px-3 py-2 text-pretty leading-snug'>
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
