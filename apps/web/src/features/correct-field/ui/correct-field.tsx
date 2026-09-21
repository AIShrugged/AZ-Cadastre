/**
 * Putting right what the engine read wrong, on the row where it is read.
 *
 * Three pieces, and the split follows where the operator's attention is:
 *
 *  - **The box** sits in the row, in the value's own column, and keeps the
 *    engine's reading printed under it while it is being typed over. The
 *    inspector is reading off a sheet on the screen beside them; a modal would
 *    take away the one thing they are copying from, and a row that replaced the
 *    old value outright would leave them nothing to check their typing against.
 *  - **The bar** belongs to the document, because the save does: one call
 *    carries every correction made to one paper, and the bar is where the count
 *    of them, the consequence and the two buttons are.
 *  - **The line** is what stands in for the bar when there is nothing to offer
 *    — a run under way — so the absence of the control is answered rather than
 *    left to be discovered.
 *
 * The consequence is stated **before** the save and not after it. Saving puts
 * the package back in the queue, throws away the report, the cross-checks and
 * the register's answers, and spends the archive-search approval: that is a
 * large thing to happen from a small action, and an operator who is told
 * afterwards has already done it.
 */
import { PencilLineIcon, PlusIcon, Undo2Icon, XIcon } from 'lucide-react';
import { useState } from 'react';

import { ReadingFigure } from '@/entities/verification-package';
import { translateOr, useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import type { FieldDto } from '@cadastre/api-contracts/verification';

import {
  EDIT_FIELD_VALUE_MAX_LENGTH,
  isOverlong,
  isStruck,
  roomLeft,
  unreadNames,
  type Corrections,
  type NoCorrection,
} from '../model';

/** The label a row carries, which is the profile's key until a dictionary has a
 *  word for it — the same fallback the register's own rows take. */
function fieldLabel(
  t: (key: string, vars?: Record<string, string | number>) => string,
  name: string,
): string {
  return translateOr(t, `field.${name}`, name);
}

/** The pencil the register offers on a row nobody is correcting yet. Quiet
 *  until the row is hovered or the key reaches it: nineteen live controls down
 *  a card would read as a form, and this surface is a register. */
export function CorrectButton({
  field,
  corrections,
}: {
  field: FieldDto;
  corrections: Corrections;
}) {
  const { t } = useI18n();

  return (
    <button
      type='button'
      onClick={() => corrections.type(field.name, field.value)}
      title={t('correct.field_action', { field: fieldLabel(t, field.name) })}
      aria-label={t('correct.field_action', {
        field: fieldLabel(t, field.name),
      })}
      className='-my-0.5 ml-1.5 inline-flex size-5 shrink-0 translate-y-0.5 items-center justify-center rounded-sm text-muted-foreground/0 transition-colors group-hover/row:text-muted-foreground hover:bg-foreground/5 hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50'
    >
      <PencilLineIcon aria-hidden className='size-3.5' />
    </button>
  );
}

/**
 * The row being typed into.
 *
 * What the register held stays printed under the box the whole time it differs,
 * with the figure it carried — an operator correcting a badly-read address is
 * copying from a sheet, and the reading they are replacing is the thing they
 * are checking themselves against. An emptied box is not an empty value: it is
 * the operator saying the paper does not state this at all, and the line under
 * it says so in those words rather than leaving a blank box to be read as
 * unfinished work.
 */
export function CorrectionBox({
  name,
  original,
  confidence,
  corrections,
}: {
  name: string;
  /** What the document holds for this key — the empty string for a key it holds
   *  nothing for. */
  original: string;
  /** The figure the reading carried, or null where there was no reading. */
  confidence: number | null;
  corrections: Corrections;
}) {
  const { t } = useI18n();
  const text = corrections.draft[name] ?? original;
  const changed = corrections.changed(name);
  const struck = changed && isStruck(corrections.draft, name);
  const overlong = isOverlong(text);
  const describedBy = `${name}-correction-note`;

  return (
    <div className='flex flex-col gap-1.5'>
      <div className='flex items-start gap-1.5'>
        <Input
          autoFocus
          value={text}
          onChange={event => corrections.type(name, event.target.value)}
          onKeyDown={event => {
            // Escape puts the row back — the way out of a box a reader opened
            // by mistake, without reaching for a button.
            if (event.key === 'Escape') corrections.revert(name);
          }}
          disabled={corrections.saving}
          aria-label={t('correct.field_action', {
            field: fieldLabel(t, name),
          })}
          aria-invalid={overlong}
          aria-describedby={describedBy}
          placeholder={t('correct.box_placeholder')}
          className='h-7 text-[0.875rem]'
        />
        <Button
          variant='ghost'
          size='icon-sm'
          onClick={() => corrections.revert(name)}
          disabled={corrections.saving}
          title={t('correct.revert')}
          aria-label={t('correct.revert')}
          className='shrink-0 text-muted-foreground'
        >
          <Undo2Icon />
        </Button>
      </div>

      <p
        id={describedBy}
        className={cn(
          'text-[0.6875rem] leading-snug',
          overlong ? 'text-failed-ink' : 'text-muted-foreground',
        )}
      >
        {overlong ? (
          t('correct.too_long', { n: EDIT_FIELD_VALUE_MAX_LENGTH })
        ) : struck ? (
          t('correct.struck')
        ) : changed ? (
          <span className='inline-flex flex-wrap items-baseline gap-x-1.5'>
            <span>{t('correct.was', { value: original })}</span>
            {confidence !== null && (
              <ReadingFigure
                confidence={confidence}
                className='text-[0.6875rem]'
              />
            )}
          </span>
        ) : (
          t('correct.box_hint')
        )}
      </p>
    </div>
  );
}

/**
 * The mark a row carries while what it shows is the operator's and not yet the
 * register's.
 *
 * It is the answer to the one thing a correction screen must never get wrong: a
 * row must never look saved before it is. So the mark is on every touched row
 * until the save comes back, and a save that is refused leaves it exactly where
 * it was.
 */
export function UnsavedMark() {
  const { t } = useI18n();

  return (
    <span className='inline-flex rounded-sm bg-issues/14 px-1.5 py-0.5 text-[0.625rem] font-medium leading-none text-issues-ink'>
      {t('correct.unsaved')}
    </span>
  );
}

/** A row for a key the profile declares and nothing was read for, opened by
 *  hand. It is a row of the card like any other until it is saved. */
export function AddValue({
  schema,
  fields,
  corrections,
}: {
  schema: readonly string[];
  fields: readonly FieldDto[];
  corrections: Corrections;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const offered = unreadNames(schema, fields, corrections.draft);
  const room = roomLeft(Object.keys(corrections.draft).length);

  if (offered.length === 0 || room <= 0) return null;

  return (
    <div className='mt-2'>
      <button
        type='button'
        aria-expanded={open}
        onClick={() => setOpen(shown => !shown)}
        className='-mx-1 flex items-center gap-1.5 rounded-sm px-1 py-0.5 text-[0.75rem] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50'
      >
        {open ? (
          <XIcon aria-hidden className='size-3.5 shrink-0' />
        ) : (
          <PlusIcon aria-hidden className='size-3.5 shrink-0' />
        )}
        {open ? t('correct.add_close') : t('correct.add_open')}
      </button>
      {open && (
        <>
          <p className='mt-1.5 max-w-[60ch] text-[0.6875rem] leading-relaxed text-muted-foreground/80'>
            {t('correct.add_note')}
          </p>
          <div className='mt-1.5 flex flex-wrap gap-1.5'>
            {offered.map(name => (
              <button
                key={name}
                type='button'
                onClick={() => {
                  corrections.open(name);
                  setOpen(false);
                }}
                className='rounded-full border border-rule px-2 py-0.5 text-[0.75rem] text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50'
              >
                {fieldLabel(t, name)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * What one save would do, said before it is made, with the two ways out of it.
 *
 * The consequence is not a warning dialog. An operator who corrects a field is
 * doing the right thing and must not be talked out of it; they only have to
 * know what happens next, which is one line above the button they are about to
 * press.
 */
export function CorrectionBar({ corrections }: { corrections: Corrections }) {
  const { t } = useI18n();
  const n = corrections.pending.length;

  if (n === 0) return null;

  return (
    <div className='mt-4 rounded-lg border border-rule bg-muted/40 px-3 py-3'>
      <p className='text-[0.8125rem] font-medium text-foreground'>
        {t('correct.pending', { n })}
      </p>
      <p className='mt-1 max-w-[70ch] text-[0.75rem] leading-relaxed text-muted-foreground'>
        {t('correct.consequence')}
      </p>
      <div className='mt-3 flex flex-wrap items-center gap-2'>
        <Button
          size='sm'
          onClick={corrections.save}
          disabled={corrections.saving || corrections.overlong}
          aria-disabled={corrections.saving || corrections.overlong}
        >
          <PencilLineIcon />
          {corrections.saving ? t('correct.saving') : t('correct.save')}
        </Button>
        <Button
          variant='ghost'
          size='sm'
          onClick={corrections.discard}
          disabled={corrections.saving}
          className='text-muted-foreground'
        >
          {t('correct.discard')}
        </Button>
        {corrections.overlong && (
          <span className='text-[0.75rem] text-failed-ink'>
            {t('correct.too_long_bar')}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Why there is no pencil on this card.
 *
 * Only the run is said. A replaced paper already carries the stamp that says
 * the case does not rest on it, and a paper with no type carries the sentence
 * that says why it has no fields; repeating either under the rows would be the
 * card answering a question it has already answered.
 */
export function NoCorrectionsNote({ reason }: { reason: NoCorrection }) {
  const { t } = useI18n();

  if (reason !== 'running') return null;

  return (
    <p className='mt-3 text-[0.75rem] leading-relaxed text-muted-foreground'>
      {t('correct.running')}
    </p>
  );
}
