/**
 * The rule this suite exists for: **what the box takes, the schema takes.**
 *
 * Every refusal here is one `CaseParameterStatementSchema` would answer with, so
 * the cases are written against the contract's own bounds rather than against
 * numbers chosen twice. A figure the box accepts and the schema refuses is a 400
 * the operator can do nothing about; a figure the box refuses and the schema
 * would have taken is a figure withheld for no reason (COMM-194).
 */
import { describe, expect, it } from 'vitest';

import {
  CaseParameterStatementSchema,
  DECLARED_YEAR_EARLIEST,
  DECLARED_YEAR_LATEST,
  type CaseParameter,
  type CaseParameterDto,
  type PackageDetailDto,
} from '@cadastre/api-contracts/verification';

import {
  figureOf,
  figureText,
  isChanged,
  isOverridden,
  readFigure,
  statementsOf,
  unreadyParameters,
  whyNotStatable,
  type Draft,
} from './statements';

const read = (
  parameter: CaseParameter,
  value: number | string | null,
  over: Partial<CaseParameterDto> = {},
): CaseParameterDto => ({
  parameter,
  value,
  source: value === null ? null : 'ReadOffDocument',
  stated: value === null ? null : String(value),
  from:
    value === null
      ? null
      : {
          documentId: 'doc-1',
          documentType: 'sketch_design',
          fieldName: parameter,
          pageNumber: 1,
          confidence: 0.9,
        },
  calculation: null,
  overriddenBy: null,
  read: null,
  ...over,
});

/** A figure as the server publishes it once an operator has stated it: theirs is
 *  the value, and what the engine made of the papers moves into `read`. */
const stated = (
  parameter: CaseParameter,
  value: number | string,
  engine: number | string | null,
): CaseParameterDto => ({
  ...read(parameter, value),
  source: 'StatedByOperator',
  from: null,
  overriddenBy: { accountId: 'acc-1', at: '2026-09-28T10:00:00.000Z' },
  read: {
    value: engine,
    source: engine === null ? null : 'ReadOffDocument',
    stated: engine === null ? null : String(engine),
    from: null,
    calculation: null,
  },
});

const draft = (over: Draft): Draft => over;

describe('a box read against what its parameter can take', () => {
  it('takes a four-digit year inside the window the engine reads one in', () => {
    expect(readFigure('builtYear', '2011')).toEqual({
      state: 'ready',
      statement: { parameter: 'builtYear', value: 2011 },
    });
  });

  it('waits while a year is still being typed rather than refusing it', () => {
    for (const half of ['2', '20', '201']) {
      expect(readFigure('builtYear', half)).toEqual({ state: 'typing' });
    }
  });

  it('refuses a year outside the window, on both sides', () => {
    expect(readFigure('builtYear', String(DECLARED_YEAR_EARLIEST - 1))).toEqual(
      { state: 'refused', why: 'year_window' },
    );
    expect(readFigure('builtYear', String(DECLARED_YEAR_LATEST + 1))).toEqual({
      state: 'refused',
      why: 'year_window',
    });
  });

  it('takes both bounds of the window, which the schema does', () => {
    for (const year of [DECLARED_YEAR_EARLIEST, DECLARED_YEAR_LATEST]) {
      expect(readFigure('builtYear', String(year))).toEqual({
        state: 'ready',
        statement: { parameter: 'builtYear', value: year },
      });
    }
  });

  it('refuses a year that is not digits', () => {
    expect(readFigure('builtYear', '2011.5')).toEqual({
      state: 'refused',
      why: 'not_a_number',
    });
    expect(readFigure('builtYear', 'до 2013')).toEqual({
      state: 'refused',
      why: 'not_a_number',
    });
  });

  it('holds storeys to a positive whole number', () => {
    expect(readFigure('storeys', '3')).toEqual({
      state: 'ready',
      statement: { parameter: 'storeys', value: 3 },
    });
    expect(readFigure('storeys', '2.5')).toEqual({
      state: 'refused',
      why: 'not_whole',
    });
    expect(readFigure('storeys', '0')).toEqual({
      state: 'refused',
      why: 'not_positive',
    });
    expect(readFigure('storeys', 'два')).toEqual({
      state: 'refused',
      why: 'not_a_number',
    });
  });

  it('takes a measurement in metres, decimal comma included', () => {
    // RU and AZ keyboards put a comma where the point goes, and the figure an
    // operator reads off a plan is written with one.
    expect(readFigure('height', '12,5')).toEqual({
      state: 'ready',
      statement: { parameter: 'height', value: 12.5 },
    });
    expect(readFigure('span', '6.2')).toEqual({
      state: 'ready',
      statement: { parameter: 'span', value: 6.2 },
    });
  });

  it('refuses a measurement of nought or less', () => {
    expect(readFigure('height', '0')).toEqual({
      state: 'refused',
      why: 'not_positive',
    });
    expect(readFigure('span', '-4')).toEqual({
      state: 'refused',
      why: 'not_positive',
    });
  });

  it('takes only the words the contract classes the land by', () => {
    expect(readFigure('landRight', 'LeaseOrUse')).toEqual({
      state: 'ready',
      statement: { parameter: 'landRight', value: 'LeaseOrUse' },
    });
    expect(readFigure('purpose', 'Residential')).toEqual({
      state: 'ready',
      statement: { parameter: 'purpose', value: 'Residential' },
    });
    expect(readFigure('purpose', 'Housing')).toEqual({
      state: 'refused',
      why: 'not_a_choice',
    });
  });

  it('reads an empty box as the revert, on every one of the six', () => {
    const parameters: CaseParameter[] = [
      'builtYear',
      'storeys',
      'height',
      'span',
      'landRight',
      'purpose',
    ];
    for (const parameter of parameters) {
      expect(readFigure(parameter, '   ')).toEqual({
        state: 'ready',
        statement: { parameter, value: null },
      });
    }
  });

  it('never produces a statement the schema would refuse', () => {
    const typed = [
      ['builtYear', '2011'],
      ['storeys', '3'],
      ['height', '12,5'],
      ['span', '6.2'],
      ['landRight', 'Ownership'],
      ['purpose', 'Other'],
      ['builtYear', ''],
    ] as const;

    for (const [parameter, text] of typed) {
      const reading = readFigure(parameter, text);
      expect(reading.state).toBe('ready');
      if (reading.state !== 'ready') continue;
      expect(
        CaseParameterStatementSchema.safeParse(reading.statement).success,
      ).toBe(true);
    }
  });

  it('sends a number as a number and never as the text it was typed as', () => {
    const reading = readFigure('storeys', '3');
    if (reading.state !== 'ready') throw new Error('expected a statement');
    expect(reading.statement.value).toBe(3);
    expect(typeof reading.statement.value).toBe('number');
  });
});

describe('what a save carries', () => {
  const parameters = [
    read('builtYear', 2011),
    read('storeys', null),
    read('height', 12),
    read('span', null),
    read('landRight', 'Ownership'),
    read('purpose', 'Residential'),
  ];

  it('carries only the cells that say something else', () => {
    const typed = draft({ builtYear: '2011', storeys: '4' });

    expect(isChanged(parameters, typed, 'builtYear')).toBe(false);
    expect(isChanged(parameters, typed, 'storeys')).toBe(true);
    expect(statementsOf(parameters, typed)).toEqual([
      { parameter: 'storeys', value: 4 },
    ]);
  });

  it('carries a figure set on a cell that had no reading — the case this exists for', () => {
    expect(statementsOf(parameters, draft({ span: '6,4' }))).toEqual([
      { parameter: 'span', value: 6.4 },
    ]);
  });

  it('states nothing where an empty box has no override to clear', () => {
    // Clearing an override that is not there changes nothing: the server stores
    // nothing, bumps no version and starts no run, so the cell must not be
    // marked unsaved or counted towards a save.
    const typed = draft({ height: '' });

    expect(isChanged(parameters, typed, 'height')).toBe(false);
    expect(statementsOf(parameters, typed)).toEqual([]);
  });

  it('clears the override where there is one, and never writes the old figure back', () => {
    const overridden = parameters.map(one =>
      one.parameter === 'height' ? stated('height', 14, 12) : one,
    );
    const typed = draft({ height: '' });

    expect(isOverridden(figureOf(overridden, 'height'))).toBe(true);
    expect(isChanged(overridden, typed, 'height')).toBe(true);
    expect(statementsOf(overridden, typed)).toEqual([
      { parameter: 'height', value: null },
    ]);
  });

  it('reverts a figure no paper ever stated to no figure at all', () => {
    const overridden = [stated('span', 6.4, null)];

    expect(statementsOf(overridden, draft({ span: '' }))).toEqual([
      { parameter: 'span', value: null },
    ]);
  });

  it('holds the save back while a figure is refused or half-typed', () => {
    expect(
      unreadyParameters(parameters, draft({ storeys: '2.5', builtYear: '20' })),
    ).toEqual(['builtYear', 'storeys']);
    expect(unreadyParameters(parameters, draft({ storeys: '4' }))).toEqual([]);
  });

  it('never exceeds the six entries one request may carry', () => {
    const all = draft({
      builtYear: '1999',
      storeys: '4',
      height: '14',
      span: '6',
      landRight: 'LeaseOrUse',
      purpose: 'Other',
    });

    expect(statementsOf(parameters, all)).toHaveLength(6);
  });

  it('opens each box on the figure the case is decided on', () => {
    expect(figureText(parameters[0] ?? null)).toBe('2011');
    expect(figureText(parameters[1] ?? null)).toBe('');
    expect(figureText(parameters[4] ?? null)).toBe('Ownership');
    expect(figureText(null)).toBe('');
  });
});

describe('when the table takes no statement at all', () => {
  const pkg = (status: PackageDetailDto['status']): PackageDetailDto =>
    ({ id: 'pkg-1', status }) as PackageDetailDto;

  it('offers nothing while a run is under way', () => {
    expect(whyNotStatable(pkg('Processing'))).toBe('running');
  });

  it('waits for a package it has just re-opened to settle', () => {
    // A second save sent before the run this one started comes back
    // CONCURRENCY_CONFLICT — a refusal the operator can do nothing about.
    expect(whyNotStatable(pkg('Pending'))).toBe('reopened');
  });

  it('offers the control on a package that has been reported on', () => {
    expect(whyNotStatable(pkg('Completed'))).toBeNull();
    expect(whyNotStatable(pkg('Failed'))).toBeNull();
  });
});
