/**
 * Setting one of the six figures the Article 8 table decides on, in the cell the
 * figure is printed in.
 *
 * The pieces and the split follow `correct-field`, deliberately and to the
 * letter: an operator who has learned to put a badly-read address right on the
 * row it was read off should not have to learn a second idiom two panels down.
 * The pencil is the same pencil, the mark is the same mark, the bar is the same
 * bar and the consequence is the same sentence.
 *
 *  - **The box** sits in the cell, in the figure's own place, and keeps what the
 *    engine read printed under it. Three of the six are typed and two are
 *    chosen: a right over the land is one of two words the contract names, and a
 *    text box for it would be a box whose only wrong answers are spellings.
 *  - **The bar** belongs to the table, because the save does: one call carries
 *    every figure the operator changed.
 *  - **The line** stands in for the bar where there is nothing to offer — a run
 *    under way, or a package re-opened and waiting for one — so the absence of
 *    the control is answered rather than left to be discovered.
 *
 * What is not the same is what the box is held to. A correction is text and the
 * contract only asks that it be short enough; a figure is a year, a count of
 * storeys, a measurement in metres or one of two words, and each is refused by
 * the schema in front of the handler. So the cell says what is wrong with what
 * is in it, in the parameter's own terms, before a save is attempted.
 */
import { PencilLineIcon, Undo2Icon } from 'lucide-react';

import { translateOr, useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';
import { EditPencil } from '@/shared/ui/edit-pencil';
import { Input } from '@/shared/ui/input';
import { SaveBar } from '@/shared/ui/save-bar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/shared/ui/select';
import {
  DECLARED_YEAR_EARLIEST,
  DECLARED_YEAR_LATEST,
  type CaseParameter,
  type CaseParameterDto,
} from '@cadastre/api-contracts/verification';

import {
  FIGURE_CHOICES,
  FIGURE_KIND,
  figureText,
  isOverridden,
  type NoStatement,
  type Statements,
} from '../model';

/** The name the table prints for a figure, which is the parameter's key until a
 *  dictionary has a word for it — the same fallback the table's own labels take. */
function figureLabel(
  t: (key: string, vars?: Record<string, string | number>) => string,
  parameter: CaseParameter,
): string {
  return translateOr(t, `provision.param.${parameter}`, parameter);
}

/** The word a chosen figure is printed as, off the same dictionary the table and
 *  the ruled-out reasons read. */
function choiceLabel(
  t: (key: string, vars?: Record<string, string | number>) => string,
  value: string,
): string {
  return translateOr(t, `provision.value.${value}`, value);
}

/** The item that stands for "no figure of the operator's", which the select
 *  cannot carry as the empty string — the same sentinel the intake form's own
 *  "nothing declared" item uses. */
const NOTHING_STATED = '\u2014';

/** The pencil the table offers on a cell nobody is editing yet. */
export function StateFigureButton({
  parameter,
  figure,
  statements,
}: {
  parameter: CaseParameter;
  figure: CaseParameterDto;
  statements: Statements;
}) {
  const { t } = useI18n();

  return (
    <EditPencil
      label={t('parameter.edit_action', { figure: figureLabel(t, parameter) })}
      onClick={() => statements.open(parameter, figureText(figure))}
      className='ml-0.5'
    />
  );
}

/**
 * The cell being set.
 *
 * What the case is decided on stays printed under the box the whole time it
 * differs, for the reason a correction keeps the engine's reading under its own:
 * the figure being replaced is what the operator checks themselves against. An
 * emptied box is not a figure of nothing — it is the revert, and the line under
 * it says so in those words.
 */
export function FigureBox({
  parameter,
  figure,
  statements,
}: {
  parameter: CaseParameter;
  figure: CaseParameterDto;
  statements: Statements;
}) {
  const { t } = useI18n();
  const kind = FIGURE_KIND[parameter];
  const text = statements.draft[parameter] ?? figureText(figure);
  const reading = statements.reading(parameter);
  const changed = statements.changed(parameter);
  const decidedOn = figure.value === null ? null : String(figure.value);
  const describedBy = `parameter-${parameter}-note`;
  const label = t('parameter.edit_action', {
    figure: figureLabel(t, parameter),
  });

  const note = (() => {
    if (reading.state === 'refused') {
      // The window's bounds are the contract's and travel with the message, so
      // the box names the years the schema would actually have taken.
      return t(`parameter.bad.${reading.why}`, {
        from: DECLARED_YEAR_EARLIEST,
        to: DECLARED_YEAR_LATEST,
      });
    }
    if (reading.state === 'typing') return t(`parameter.hint.${kind}`);
    if (reading.statement.value === null) {
      // Clearing is the revert, and it only means anything where there is an
      // override. With none, the box is simply empty and nothing is stated.
      return isOverridden(figure)
        ? t('parameter.reverts')
        : t('parameter.states_nothing');
    }
    if (!changed) return t(`parameter.hint.${kind}`);
    return decidedOn === null
      ? t('parameter.was_unestablished')
      : t('parameter.was', {
          value: kind === 'choice' ? choiceLabel(t, decidedOn) : decidedOn,
        });
  })();

  return (
    <div className='flex w-full min-w-0 flex-col gap-1.5'>
      <div className='flex items-start gap-1.5'>
        {kind === 'choice' ? (
          <Select
            value={text === '' ? NOTHING_STATED : text}
            onValueChange={value =>
              statements.type(
                parameter,
                value === NOTHING_STATED ? '' : String(value),
              )
            }
            disabled={statements.saving}
          >
            <SelectTrigger
              aria-label={label}
              aria-describedby={describedBy}
              className='h-7 w-full min-w-0 bg-card text-[0.875rem] data-[size=default]:h-7'
            >
              <span className='min-w-0 truncate'>
                {text === '' ? t('parameter.choose') : choiceLabel(t, text)}
              </span>
            </SelectTrigger>
            <SelectContent align='start'>
              {/* Putting the figure back has to be on the list: an operator who
                  chose a word by mistake would otherwise have no way back to
                  the reading, and on this control there is no box to empty. */}
              <SelectItem value={NOTHING_STATED}>
                {isOverridden(figure)
                  ? t('parameter.revert_choice')
                  : t('parameter.choose')}
              </SelectItem>
              {(FIGURE_CHOICES[parameter] ?? []).map(value => (
                <SelectItem key={value} value={value}>
                  {choiceLabel(t, value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            autoFocus
            // `inputMode` and not `type='number'`: a spinner on a year is noise,
            // and a number input hides what was typed when it cannot parse it —
            // which is the one thing the note below has to be able to name.
            inputMode='decimal'
            value={text}
            onChange={event => statements.type(parameter, event.target.value)}
            onKeyDown={event => {
              // Escape puts the cell back — the way out of a box a reader opened
              // by mistake, without reaching for a button.
              if (event.key === 'Escape') statements.close(parameter);
            }}
            disabled={statements.saving}
            aria-label={label}
            aria-invalid={reading.state === 'refused'}
            aria-describedby={describedBy}
            placeholder={t(`parameter.hint.${kind}`)}
            className='h-7 tabular-nums text-[0.875rem]'
          />
        )}
        <Button
          variant='ghost'
          size='icon-sm'
          onClick={() => statements.close(parameter)}
          disabled={statements.saving}
          title={t('parameter.close')}
          aria-label={t('parameter.close')}
          className='shrink-0 text-muted-foreground'
        >
          <Undo2Icon />
        </Button>
      </div>

      <p
        id={describedBy}
        className={cn(
          'text-[0.6875rem] leading-snug',
          reading.state === 'refused'
            ? 'text-failed-ink'
            : 'text-muted-foreground',
        )}
      >
        {note}
      </p>
    </div>
  );
}

/**
 * Putting the engine's figure back, offered where an override is in force.
 *
 * It is the same call with `value: null` and never the old figure written back
 * over itself — which is what makes it work on a figure no paper ever stated: a
 * revert there leaves the cell with no reading, not with a figure invented to
 * fill it.
 */
export function RevertFigure({
  parameter,
  statements,
}: {
  parameter: CaseParameter;
  statements: Statements;
}) {
  const { t } = useI18n();

  return (
    <button
      type='button'
      onClick={() => statements.clear(parameter)}
      className='inline-flex items-center gap-1 rounded-sm underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50'
    >
      <Undo2Icon aria-hidden className='size-3 shrink-0' />
      {t('parameter.revert')}
    </button>
  );
}

/** What one save of the case's figures would do, on the shared bar. */
export function StatementBar({ statements }: { statements: Statements }) {
  const { t } = useI18n();
  const n = statements.touched.length;
  const blocked = statements.unready.length > 0;

  if (n === 0) return null;

  return (
    <SaveBar
      count={t('parameter.pending', { n })}
      consequence={t('correct.consequence')}
      save={statements.save}
      saveLabel={statements.saving ? t('correct.saving') : t('correct.save')}
      discard={statements.discard}
      discardLabel={t('correct.discard')}
      saving={statements.saving}
      blocked={blocked || statements.pending.length === 0}
      warning={
        blocked
          ? t('parameter.not_ready', {
              figures: statements.unready
                .map(parameter => figureLabel(t, parameter))
                .join(', '),
            })
          : null
      }
      icon={<PencilLineIcon />}
    />
  );
}

/**
 * Why there is no pencil on the table.
 *
 * Both reasons are said, because neither is written anywhere else on the panel:
 * a run under way is visible at the head of the screen, but "wait for the run
 * this save started" is not, and an operator who has just saved a figure and
 * finds the pencils gone is owed the sentence.
 */
export function NoStatementsNote({ reason }: { reason: NoStatement }) {
  const { t } = useI18n();

  return (
    <p className='mt-3 text-[0.75rem] leading-relaxed text-muted-foreground'>
      {t(reason === 'running' ? 'parameter.running' : 'parameter.reopened')}
    </p>
  );
}
