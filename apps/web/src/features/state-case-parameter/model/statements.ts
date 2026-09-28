/**
 * What an operator has typed over the six figures the Article 8 table decides
 * on, before any of it is saved.
 *
 * A flat map of parameter to the text in that cell's box, for the reason
 * `correct-field` holds one: a box the operator opened and typed the same figure
 * back into is not a statement, and a map keyed by the figure is what lets the
 * table tell "touched, and the same" from "changed" without a second structure
 * to keep in step. What goes on the wire is worked out from the map and the
 * case's published figures together (`statementsOf`), at the moment of saving,
 * which is the only moment the two have to agree.
 *
 * **Every check here is the contract's own.** A year is held to the window the
 * engine reads a year in, storeys to a positive whole number, a height and a
 * span to a positive measurement, and the two classes of land to the words the
 * contract names — because that is exactly what `CaseParameterStatementSchema`
 * refuses in front of the handler (COMM-193). A screen with a window of its own
 * would either send a 400 the operator can do nothing about or withhold a figure
 * the engine would have taken.
 *
 * **A number goes on the wire as a number.** The box holds text and the contract
 * takes `z.number()`, so `"3"` is a 400 — the coercion happens here, once, and
 * every statement leaves this module already typed for its own parameter.
 */
import { takesFiles } from '@/entities/verification-package';
import {
  DECLARED_YEAR_EARLIEST,
  DECLARED_YEAR_LATEST,
  LandPurposeSchema,
  LandRightSchema,
  type CaseParameter,
  type CaseParameterDto,
  type CaseParameterStatement,
  type PackageDetailDto,
} from '@cadastre/api-contracts/verification';

/** Every year the engine reads is four digits, the same count the intake box
 *  counts to before it argues with what is being typed. */
const DIGITS_IN_A_YEAR = 4;

/** The boxes the operator has touched on the case's figures, by parameter. */
export type Draft = Readonly<Partial<Record<CaseParameter, string>>>;

/**
 * How a figure is set, which is what decides the control: three of them are
 * typed and two are chosen from the words the contract names.
 *
 * `metres` is apart from `count` because the unit is part of the question — a
 * height of 12.5 is a height and a storey-and-a-half is not a number of storeys.
 */
export type FigureKind = 'year' | 'count' | 'metres' | 'choice';

export const FIGURE_KIND: Record<CaseParameter, FigureKind> = {
  builtYear: 'year',
  storeys: 'count',
  height: 'metres',
  span: 'metres',
  landRight: 'choice',
  purpose: 'choice',
};

/** The words each chosen figure may take, off the contract's own enums so a
 *  choice this screen offers is never one the schema refuses. Only two of the
 *  six are chosen, so the other four are absent rather than empty. */
export const FIGURE_CHOICES: Partial<Record<CaseParameter, readonly string[]>> =
  {
    landRight: LandRightSchema.options,
    purpose: LandPurposeSchema.options,
  };

/** Why the contract will not take what is in the box. Each is a refusal the
 *  schema would answer with, worded here so the box can say it first. */
export type BadFigure =
  | 'not_a_number'
  | 'not_whole'
  | 'not_positive'
  | 'year_window'
  | 'not_a_choice';

/**
 * A box, read: a statement ready to go on the wire, a figure still being typed,
 * or one the contract would refuse.
 *
 * `typing` is what keeps the table from arguing mid-keystroke — every year is
 * four digits, so one, two or three of them is a box being filled and not a
 * figure to refuse. It is also not ready, so it holds the save back rather than
 * being sent half-written.
 */
export type FigureReading =
  | { state: 'ready'; statement: CaseParameterStatement }
  | { state: 'typing' }
  | { state: 'refused'; why: BadFigure };

/** A decimal, with the comma the RU and AZ keyboards put where the point goes. */
function decimal(text: string): number | null {
  if (!/^-?\d+(?:[.,]\d+)?$/.test(text)) return null;
  const figure = Number(text.replace(',', '.'));
  return Number.isFinite(figure) ? figure : null;
}

/** A positive measurement in metres — the one shape `height` and `span` share. */
function metres(text: string): number | BadFigure {
  const figure = decimal(text);
  if (figure === null) return 'not_a_number';
  return figure > 0 ? figure : 'not_positive';
}

/**
 * One box, read against what its own parameter can take.
 *
 * An empty box is a statement of `null`, which is the revert: it clears the
 * override and puts the figure back to what the papers say. It is the only way
 * back — while an override stands nothing the engine reads displaces it — and
 * it is never the old figure written back over itself.
 */
export function readFigure(
  parameter: CaseParameter,
  text: string,
): FigureReading {
  const trimmed = text.trim();

  switch (parameter) {
    case 'builtYear': {
      if (trimmed === '') {
        return { state: 'ready', statement: { parameter, value: null } };
      }
      // A year is digits and nothing else: a decimal point in one is not a year
      // being typed, it is not a year.
      if (!/^\d+$/.test(trimmed)) {
        return { state: 'refused', why: 'not_a_number' };
      }
      if (trimmed.length < DIGITS_IN_A_YEAR) return { state: 'typing' };
      const year = Number(trimmed);
      return year < DECLARED_YEAR_EARLIEST || year > DECLARED_YEAR_LATEST
        ? { state: 'refused', why: 'year_window' }
        : { state: 'ready', statement: { parameter, value: year } };
    }
    case 'storeys': {
      if (trimmed === '') {
        return { state: 'ready', statement: { parameter, value: null } };
      }
      const figure = decimal(trimmed);
      if (figure === null) return { state: 'refused', why: 'not_a_number' };
      if (!Number.isInteger(figure)) {
        return { state: 'refused', why: 'not_whole' };
      }
      return figure > 0
        ? { state: 'ready', statement: { parameter, value: figure } }
        : { state: 'refused', why: 'not_positive' };
    }
    case 'height': {
      if (trimmed === '') {
        return { state: 'ready', statement: { parameter, value: null } };
      }
      const figure = metres(trimmed);
      return typeof figure === 'number'
        ? { state: 'ready', statement: { parameter, value: figure } }
        : { state: 'refused', why: figure };
    }
    case 'span': {
      if (trimmed === '') {
        return { state: 'ready', statement: { parameter, value: null } };
      }
      const figure = metres(trimmed);
      return typeof figure === 'number'
        ? { state: 'ready', statement: { parameter, value: figure } }
        : { state: 'refused', why: figure };
    }
    case 'landRight': {
      if (trimmed === '') {
        return { state: 'ready', statement: { parameter, value: null } };
      }
      const right = LandRightSchema.safeParse(trimmed);
      return right.success
        ? { state: 'ready', statement: { parameter, value: right.data } }
        : { state: 'refused', why: 'not_a_choice' };
    }
    case 'purpose': {
      if (trimmed === '') {
        return { state: 'ready', statement: { parameter, value: null } };
      }
      const purpose = LandPurposeSchema.safeParse(trimmed);
      return purpose.success
        ? { state: 'ready', statement: { parameter, value: purpose.data } }
        : { state: 'refused', why: 'not_a_choice' };
    }
  }
}

/** The case's published figure for one parameter, or null where the server sent
 *  no such figure — a guard, since the case always publishes all six. */
export function figureOf(
  parameters: readonly CaseParameterDto[],
  parameter: CaseParameter,
): CaseParameterDto | null {
  return parameters.find(one => one.parameter === parameter) ?? null;
}

/** Whether an operator has already stated this figure. The source and
 *  `overriddenBy` say the same thing; the source is what the case is decided
 *  on, so the source is what is read. */
export function isOverridden(figure: CaseParameterDto | null): boolean {
  return figure?.source === 'StatedByOperator';
}

/** What the box opens with and what the cell is compared against: the figure the
 *  table is decided on, as text. Empty where nothing established it — which is
 *  precisely the cell this feature exists for. */
export function figureText(figure: CaseParameterDto | null): string {
  if (figure === null || figure.value === null) return '';
  return String(figure.value);
}

/** What this cell's box holds: what the operator typed, or the figure the case
 *  is decided on until they type something. */
export function boxText(
  parameters: readonly CaseParameterDto[],
  draft: Draft,
  parameter: CaseParameter,
): string {
  return draft[parameter] ?? figureText(figureOf(parameters, parameter));
}

/**
 * Whether this cell's box says something other than what the case is decided on.
 *
 * An emptied box is a change only where there is an override to clear. With
 * none, clearing states nothing — the server stores nothing, bumps no version
 * and starts no run — so the table must not mark the row unsaved or count it
 * towards a save that would do nothing.
 */
export function isChanged(
  parameters: readonly CaseParameterDto[],
  draft: Draft,
  parameter: CaseParameter,
): boolean {
  const typed = draft[parameter];
  if (typed === undefined) return false;

  const figure = figureOf(parameters, parameter);
  const trimmed = typed.trim();
  if (trimmed === figureText(figure).trim()) return false;
  return trimmed === '' ? isOverridden(figure) : true;
}

/**
 * What goes on the wire: every figure whose box says something other than what
 * the case is decided on, already typed for its own parameter.
 *
 * One call carries all of them, because that is what an operator does — they
 * fix a form and they save it. A call per keystroke would re-open the package
 * and run the whole pipeline six times over one correction (ADR-0033).
 */
export function statementsOf(
  parameters: readonly CaseParameterDto[],
  draft: Draft,
): CaseParameterStatement[] {
  return changedParameters(parameters, draft).flatMap(parameter => {
    const reading = readFigure(
      parameter,
      boxText(parameters, draft, parameter),
    );
    return reading.state === 'ready' ? [reading.statement] : [];
  });
}

/**
 * The figures whose boxes are not ready to be sent — refused by the contract's
 * own rule, or still being typed.
 *
 * They hold the save back rather than being dropped from it silently: a save
 * that quietly left out the one figure the operator came to set would look like
 * it had worked.
 */
export function unreadyParameters(
  parameters: readonly CaseParameterDto[],
  draft: Draft,
): CaseParameter[] {
  return changedParameters(parameters, draft).filter(
    parameter =>
      readFigure(parameter, boxText(parameters, draft, parameter)).state !==
      'ready',
  );
}

/** Every figure whose box says something other than what the case holds, in the
 *  order the table prints its columns. */
export function changedParameters(
  parameters: readonly CaseParameterDto[],
  draft: Draft,
): CaseParameter[] {
  return parameters
    .map(one => one.parameter)
    .filter(parameter => isChanged(parameters, draft, parameter));
}

export function withText(
  draft: Draft,
  parameter: CaseParameter,
  text: string,
): Draft {
  return { ...draft, [parameter]: text };
}

/** The cell put back as the case holds it — the box closed, nothing stated. */
export function withoutText(draft: Draft, parameter: CaseParameter): Draft {
  const { [parameter]: _closed, ...rest } = draft;
  return rest;
}

/**
 * Why this package takes no statement — the client's own reading of the two
 * facts the detail response already states, so the control is never offered and
 * then refused. The refusals remain the backstop and this is not a copy of the
 * policy.
 */
export type NoStatement =
  /** A run is under way. `PACKAGE_NOT_TAKING_FILES`, the same state test a
   *  correction and an added file are put to: the pipeline reads the files it
   *  started with. */
  | 'running'
  /**
   * The package has been re-opened and the run that follows has not started yet.
   *
   * Saving a figure drops the report, puts the package back to `Pending` and
   * publishes the event a run picks up. A second save sent into that gap loses
   * on the aggregate version and comes back `CONCURRENCY_CONFLICT` — a refusal
   * the operator can do nothing about and would read as the figure not having
   * been taken. So the table waits for the package to settle (COMM-193).
   */
  | 'reopened';

export function whyNotStatable(pkg: PackageDetailDto): NoStatement | null {
  if (!takesFiles(pkg.status)) return 'running';
  return pkg.status === 'Pending' ? 'reopened' : null;
}
