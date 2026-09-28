/**
 * The case's six figures as the operator is setting them, from the first
 * keystroke to the run they start.
 *
 * The state lives with the panel that draws the table, because that is the unit
 * the contract is shaped for: one call carries every figure the operator
 * changed. Nothing leaves the browser until they save.
 *
 * The answer to a save is the whole package, so it is written into the cache the
 * detail screen is already reading rather than being followed by a fetch of what
 * the server has just said. The screen then re-renders off the response —
 * re-opened, its report gone, back in the queue — and its own poll takes over
 * from there. That is also what closes the table: the package comes back
 * `Pending`, and `whyNotStatable` reads that as "wait for it to settle", so a
 * second save cannot race the run into a `CONCURRENCY_CONFLICT`.
 */
import { useState } from 'react';
import { toast } from 'sonner';

import {
  useKeepPackage,
  useStateCaseParametersMutation,
} from '@/entities/verification-package';
import { failureCode } from '@/shared/api';
import { translateOr, useI18n } from '@/shared/i18n';
import type {
  CaseParameter,
  CaseParameterDto,
  CaseParameterStatement,
} from '@cadastre/api-contracts/verification';

import {
  boxText,
  changedParameters,
  isChanged,
  readFigure,
  statementsOf,
  unreadyParameters,
  withoutText,
  withText,
  type Draft,
  type FigureReading,
} from './statements';

export type Statements = {
  draft: Draft;
  /** Every figure the save would carry, as the wire takes them. */
  pending: readonly CaseParameterStatement[];
  /** Figures the contract would refuse, or that are still being typed. While
   *  there is one the save is held back. */
  unready: readonly CaseParameter[];
  /** Every cell the operator has changed to some effect, ready or not — what the
   *  bar counts, so a refused entry is one figure waiting and not nought. */
  touched: readonly CaseParameter[];
  saving: boolean;
  /** Whether this cell has a box open on it — the table draws a box where there
   *  is one and a figure where there is not. */
  opened: (parameter: CaseParameter) => boolean;
  /** Whether this cell's box says something other than what the case is decided
   *  on, which is what the cell has to be marked unsaved for. */
  changed: (parameter: CaseParameter) => boolean;
  /** This cell's box read against what its parameter can take, so the cell can
   *  say what is wrong with it before the save is attempted. */
  reading: (parameter: CaseParameter) => FigureReading;
  type: (parameter: CaseParameter, text: string) => void;
  /** Open the box on a figure, holding what the case is decided on. */
  open: (parameter: CaseParameter, text: string) => void;
  /** Open it emptied — the revert, which clears the override. */
  clear: (parameter: CaseParameter) => void;
  /** Close one box and put the cell back as the case holds it. */
  close: (parameter: CaseParameter) => void;
  /** Throw the whole draft away — the table goes back to the server's figures. */
  discard: () => void;
  save: () => void;
};

export function useStatements(
  packageId: string,
  parameters: readonly CaseParameterDto[],
): Statements {
  const { t } = useI18n();
  const keep = useKeepPackage();
  const [state, { isLoading: saving }] = useStateCaseParametersMutation();
  const [draft, setDraft] = useState<Draft>({});

  const pending = statementsOf(parameters, draft);
  const unready = unreadyParameters(parameters, draft);
  const touched = changedParameters(parameters, draft);

  async function save() {
    if (saving || unready.length > 0 || pending.length === 0) return;
    try {
      const pkg = await state({
        id: packageId,
        body: { parameters: pending },
      }).unwrap();
      // The screen is looking at this cache entry; the answer is the package as
      // it now stands, so it goes straight in.
      keep(pkg);
      setDraft({});
      toast(t('parameter.saved'));
    } catch (error) {
      // The draft is kept, and kept marked as unsaved. Dropping it would throw
      // away the figures the operator read off the papers over a refusal they
      // can act on — and the cells go on saying "not saved yet", so none of them
      // ever shows a figure as one the case is decided on when it is not.
      const code = failureCode(error);
      const generic = t('parameter.failed');
      toast.error(code ? translateOr(t, `error.${code}`, generic) : generic);
    }
  }

  return {
    draft,
    pending,
    unready,
    touched,
    saving,
    opened: parameter => parameter in draft,
    changed: parameter => isChanged(parameters, draft, parameter),
    reading: parameter =>
      readFigure(parameter, boxText(parameters, draft, parameter)),
    type: (parameter, text) =>
      setDraft(current => withText(current, parameter, text)),
    open: (parameter, text) =>
      setDraft(current => withText(current, parameter, text)),
    clear: parameter => setDraft(current => withText(current, parameter, '')),
    close: parameter => setDraft(current => withoutText(current, parameter)),
    discard: () => setDraft({}),
    save: () => void save(),
  };
}
