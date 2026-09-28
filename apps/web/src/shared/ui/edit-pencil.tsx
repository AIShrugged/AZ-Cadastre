/**
 * The pencil a register offers on a line nobody is editing yet.
 *
 * Quiet until the line is hovered or the key reaches it: nineteen live controls
 * down a card would read as a form, and these surfaces are registers. The label
 * is the caller's, because only the caller knows what the line is.
 *
 * In `shared/ui` for the reason `unsaved-mark` is: the document rows and the
 * case's six figures are edited by two features, and one pencil drawn two ways
 * is two pencils (COMM-194).
 */
import { PencilLineIcon } from 'lucide-react';

import { cn } from '@/shared/lib/cn';

export function EditPencil({
  label,
  onClick,
  className,
}: {
  /** What this pencil opens, in words — the title and the accessible name. */
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        '-my-0.5 inline-flex size-5 shrink-0 translate-y-0.5 items-center justify-center rounded-sm text-muted-foreground/0 transition-colors group-hover/row:text-muted-foreground hover:bg-foreground/5 hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
        className,
      )}
    >
      <PencilLineIcon aria-hidden className='size-3.5' />
    </button>
  );
}
