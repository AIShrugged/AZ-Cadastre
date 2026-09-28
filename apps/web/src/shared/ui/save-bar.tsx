/**
 * What one save would do, said before it is made, with the two ways out of it.
 *
 * The consequence is not a warning dialog. An operator who puts a reading right
 * is doing the right thing and must not be talked out of it; they only have to
 * know what happens next, which is one line above the button they are about to
 * press.
 *
 * Shared because two writes on the case screen carry the same consequence —
 * correcting a document's fields and stating the case's own figures both re-open
 * the package and verify it afresh — and a reader should meet that sentence in
 * the same shape both times (COMM-194). What the sentence says is the caller's;
 * this only says what the bar looks like.
 */
import type { ReactNode } from 'react';

import { Button } from '@/shared/ui/button';

export function SaveBar({
  count,
  consequence,
  save,
  saveLabel,
  discard,
  discardLabel,
  saving,
  blocked,
  warning,
  icon,
}: {
  /** What is waiting to be saved, in words — "Corrections to save: 3". */
  count: string;
  /** What saving does, in one line. */
  consequence: string;
  save: () => void;
  saveLabel: string;
  discard: () => void;
  discardLabel: string;
  saving: boolean;
  /** Something in the draft the contract will not take, so the save is refused
   *  here rather than by the server. */
  blocked: boolean;
  /** Why it is blocked, beside the buttons. */
  warning?: string | null;
  icon?: ReactNode;
}) {
  return (
    <div className='mt-4 rounded-lg border border-rule bg-muted/40 px-3 py-3'>
      <p className='text-[0.8125rem] font-medium text-foreground'>{count}</p>
      <p className='mt-1 max-w-[70ch] text-[0.75rem] leading-relaxed text-muted-foreground'>
        {consequence}
      </p>
      <div className='mt-3 flex flex-wrap items-center gap-2'>
        <Button
          size='sm'
          onClick={save}
          disabled={saving || blocked}
          aria-disabled={saving || blocked}
        >
          {icon}
          {saveLabel}
        </Button>
        <Button
          variant='ghost'
          size='sm'
          onClick={discard}
          disabled={saving}
          className='text-muted-foreground'
        >
          {discardLabel}
        </Button>
        {warning && (
          <span className='text-[0.75rem] text-failed-ink'>{warning}</span>
        )}
      </div>
    </div>
  );
}
