import * as React from 'react';

import { cn } from '@/shared/lib/cn';

/**
 * A multi-line field, styled off `Input` so the two read as one control in a
 * form rather than as two borrowed from different places.
 *
 * A plain `textarea`: the field this surface asks for takes a person's own
 * words and nothing else, and the primitive library adds nothing to that a
 * native element does not already do.
 */
function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot='textarea'
      className={cn(
        'field-sizing-content min-h-16 w-full min-w-0 resize-none rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
