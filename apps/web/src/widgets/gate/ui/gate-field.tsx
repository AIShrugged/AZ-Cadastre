/**
 * One labelled box on a gate form, with the refusal that belongs to it said
 * under it.
 *
 * Under the box and not in a toast: a toast about a field is a sentence the
 * reader has to carry back to a box they can no longer see it beside, and it is
 * gone by the time they have found the box again.
 */
import { useId, type ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';
import { Input } from '@/shared/ui/input';

export function GateField({
  label,
  hint,
  error,
  ...input
}: {
  label: string;
  /** What the box takes, where that is not obvious from its name. */
  hint?: ReactNode;
  /** What is wrong with what is in it, or null while nothing is. */
  error?: string | null;
} & React.ComponentProps<typeof Input>) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? hint;

  return (
    <div className='flex flex-col gap-1.5'>
      <label
        htmlFor={id}
        className='text-[0.8125rem] font-medium text-foreground'
      >
        {label}
      </label>
      <Input
        id={id}
        aria-invalid={error != null}
        aria-describedby={note ? noteId : undefined}
        className='h-9 border-input bg-background text-[0.875rem]'
        {...input}
      />
      {note && (
        <p
          id={noteId}
          className={cn(
            'text-[0.75rem] leading-snug',
            error != null ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {note}
        </p>
      )}
    </div>
  );
}
