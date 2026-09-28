import { InvalidCaseParameterException } from '../exceptions/index.js';
import {
  EARLIEST_YEAR,
  LATEST_YEAR,
} from '../services/building-measures.service.js';

import type { EditorAccountId } from './entity-ids/index.js';
import {
  LAND_PURPOSES,
  LAND_RIGHTS,
  type CaseParameterKey,
  type LandPurpose,
  type LandRight,
} from './provision.vo.js';

/**
 * A figure of the decision table as an operator states it: a number for the
 * four measured parameters, a word for the two the contract classes.
 */
export type CaseParameterValue = number | LandRight | LandPurpose;

/**
 * One of the six figures of the Article 8 table, stated by a person rather than
 * read off a paper (ADR-0025).
 *
 * The parameter is an input to the table and never its conclusion, so this is
 * the one thing about it worth storing: the provision is still worked out on
 * every read, off the papers where nobody has corrected them and off this where
 * somebody has (ADR-0014). Correcting the field the figure is printed on cannot
 * do this job — a parameter may have no reading at all, the right over the land
 * comes from the *kind* of title document rather than any line of it, and the
 * span is calculated out of the axis chains, so no single field carries it.
 *
 * The editor and the moment travel with the value, as they do on a corrected
 * field: an inspector reading a figure that disagrees with the papers has to be
 * able to see who put it there (ADR-0033).
 */
export class StatedCaseParameter {
  private constructor(
    public readonly parameter: CaseParameterKey,
    public readonly value: CaseParameterValue,
    public readonly by: EditorAccountId,
    public readonly at: Date,
  ) {}

  /**
   * What an operator typed, held to what the parameter can be. A figure the
   * table could never be decided on is refused here and not stored: an override
   * is believed absolutely, so an impossible one would decide the case.
   */
  static of(state: {
    parameter: CaseParameterKey;
    value: number | string;
    by: EditorAccountId;
    at: Date;
  }): StatedCaseParameter {
    return new StatedCaseParameter(
      state.parameter,
      understood(state.parameter, state.value),
      state.by,
      state.at,
    );
  }

  /*
   * The same value back off a row, which holds every parameter's as text: the
   * six are two numbers, two measurements and two words, and a column per shape
   * would be five columns nearly always null.
   *
   * Put through the same understanding as a fresh statement, deliberately. A
   * stored figure that no longer passes it — a window that moved, a word a
   * profile dropped — is a figure that must not go on deciding a case quietly.
   */
  static restore(state: {
    parameter: CaseParameterKey;
    value: string;
    by: EditorAccountId;
    at: Date;
  }): StatedCaseParameter {
    return StatedCaseParameter.of(state);
  }

  /** As a row holds it. */
  get stored(): string {
    return String(this.value);
  }

  // What the operator stated, in the words a reader is shown beside the
  // engine's own reading.
  get stated(): string {
    return this.stored;
  }

  /*
   * Whether this states the same figure as that, so a second save of the same
   * form is a no-op.
   *
   * Compared on the understood value and not on the text: "12.0" typed over a
   * stored `12` is the operator stating the height they already stated, and
   * re-opening the package for it would re-verify a package that has been
   * re-verified since (ADR-0033).
   */
  statesTheSameAs(value: number | string): boolean {
    return understood(this.parameter, value) === this.value;
  }
}

function understood(
  parameter: CaseParameterKey,
  value: number | string,
): CaseParameterValue {
  switch (parameter) {
    case 'builtYear':
      // The window a year read off a paper is held to, for the reason the
      // declared year is held to it: a figure the engine could never read would
      // make every comparison against it a question about the window.
      return whole(
        parameter,
        value,
        year => year >= EARLIEST_YEAR && year <= LATEST_YEAR,
      );
    case 'storeys':
      return whole(parameter, value, storeys => storeys > 0);
    // Metres, and a building has neither a height nor a span of nought.
    case 'height':
    case 'span':
      return measured(parameter, value);
    case 'landRight':
      return word(parameter, value, LAND_RIGHTS);
    case 'purpose':
      return word(parameter, value, LAND_PURPOSES);
  }
}

function measured(parameter: CaseParameterKey, value: number | string): number {
  const metres = numberIn(value);

  if (metres === null || metres <= 0) {
    throw new InvalidCaseParameterException(parameter, value);
  }

  return metres;
}

function whole(
  parameter: CaseParameterKey,
  value: number | string,
  within: (value: number) => boolean,
): number {
  const counted = numberIn(value);

  if (counted === null || !Number.isInteger(counted) || !within(counted)) {
    throw new InvalidCaseParameterException(parameter, value);
  }

  return counted;
}

function word<T extends string>(
  parameter: CaseParameterKey,
  value: number | string,
  allowed: readonly T[],
): T {
  const said = allowed.find(candidate => candidate === value);

  if (said === undefined) {
    throw new InvalidCaseParameterException(parameter, value);
  }

  return said;
}

// A finite number, whether it arrived as one or as the text a row stores it in.
// A blank string is `Number('') === 0` and is not a figure anybody stated.
function numberIn(value: number | string): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value.trim() === '') return null;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}
