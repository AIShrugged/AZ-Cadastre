/**
 * The reason a provision was ruled out, in both the rule's terms and the
 * package's — and the real dictionary, because the wording is the deliverable:
 * a line built out of keys three locales have no word for renders as
 * `PROVISION.COND.REASON` and would pass a test written against a stub `t`.
 */
import { describe, expect, it } from 'vitest';

import { DICTS } from '@/shared/i18n';
import type {
  CaseParameter,
  CaseParameterDto,
  CaseProvisionDto,
  ConditionExpectationDto,
} from '@cadastre/api-contracts/verification';

import {
  asRead,
  conditionReasons,
  expectationPhrase,
  parameterPhrase,
  undecidedNames,
} from './condition-reason';

type ProvisionRule = CaseProvisionDto['rules'][number];

const translator = (locale: 'en' | 'ru' | 'az') => {
  const dict: Record<string, string> = DICTS[locale];
  return (key: string, vars?: Record<string, string | number>): string => {
    const word = dict[key];
    if (word === undefined) return key;
    return vars
      ? word.replaceAll(/\{(\w+)\}/g, (whole, name: string) =>
          name in vars ? String(vars[name]) : whole,
        )
      : word;
  };
};

const t = translator('en');

const parameter = (
  name: CaseParameter,
  over: Partial<CaseParameterDto> = {},
): CaseParameterDto => ({
  parameter: name,
  value: 2,
  source: 'ReadOffDocument',
  stated: null,
  from: null,
  calculation: null,
  overriddenBy: null,
  read: null,
  ...over,
});

const rule = (
  conditions: {
    parameter: CaseParameter;
    holds: boolean | null;
    expected: ConditionExpectationDto;
  }[],
): ProvisionRule =>
  ({
    provision: '8.0.9.1.2',
    description: 'Built before 2013, up to 12 m, owned and for housing',
    conditions,
    excluded: true,
    holds: false,
  }) as ProvisionRule;

const OWNERSHIP: ConditionExpectationDto = {
  kind: 'OneOf',
  values: ['Ownership'],
};
const UP_TO_12: ConditionExpectationDto = {
  kind: 'Range',
  min: null,
  minInclusive: false,
  max: 12,
  maxInclusive: true,
};
const BEFORE_2013: ConditionExpectationDto = {
  kind: 'Range',
  min: null,
  minInclusive: true,
  max: 2013,
  maxInclusive: false,
};

describe('what the rule asked of a figure', () => {
  it('names the words a set asks for, in the reader’s language', () => {
    expect(expectationPhrase(t, OWNERSHIP)).toBe('Ownership');
    expect(expectationPhrase(translator('az'), OWNERSHIP)).toBe('Mülkiyyət');
  });

  it('joins a set of several with the language’s own “or”', () => {
    expect(
      expectationPhrase(t, {
        kind: 'OneOf',
        values: ['Ownership', 'LeaseOrUse'],
      }),
    ).toBe('Ownership or Lease or use');
  });

  it('falls back to the wire’s word for a value this build has never heard of', () => {
    expect(
      expectationPhrase(t, { kind: 'OneOf', values: ['Emphyteusis'] }),
    ).toBe('Emphyteusis');
  });

  // The inclusivity is the policy's and is read off the flag, never off the
  // parameter: the same `height` is a ceiling in one rule and a floor in
  // another, and 2013 is exclusive above and inclusive below.
  it('reads an inclusive ceiling apart from an exclusive one', () => {
    expect(expectationPhrase(t, UP_TO_12)).toBe('up to 12');
    expect(expectationPhrase(t, BEFORE_2013)).toBe('less than 2013');
  });

  it('reads an inclusive floor apart from an exclusive one', () => {
    expect(
      expectationPhrase(t, {
        kind: 'Range',
        min: 2013,
        minInclusive: true,
        max: null,
        maxInclusive: false,
      }),
    ).toBe('from 2013');
    expect(
      expectationPhrase(t, {
        kind: 'Range',
        min: 12,
        minInclusive: false,
        max: null,
        maxInclusive: true,
      }),
    ).toBe('more than 12');
  });

  // A null bound is what says a side does not exist; its flag is set all the
  // same and reading it would invent a bound the rule never declared.
  it('says nothing of a side the rule left open, whatever its flag', () => {
    expect(expectationPhrase(t, UP_TO_12)).not.toContain('more than');
    expect(
      expectationPhrase(t, {
        kind: 'Range',
        min: 3,
        minInclusive: true,
        max: 9,
        maxInclusive: false,
      }),
    ).toBe('from 3 and less than 9');
  });
});

describe('the figure as the package established it', () => {
  it('says a word in the reader’s language and a number as it stands', () => {
    expect(
      parameterPhrase(t, parameter('landRight', { value: 'LeaseOrUse' }), 'en'),
    ).toBe('Lease or use');
    expect(parameterPhrase(t, parameter('height', { value: 12.5 }), 'en')).toBe(
      '12.5',
    );
  });

  it('keeps a reading refused apart from a figure nothing stated', () => {
    expect(parameterPhrase(t, parameter('height', { value: null }), 'en')).toBe(
      'Not established',
    );
    expect(
      parameterPhrase(
        t,
        parameter('height', { value: null, stated: '2 mərtəbə' }),
        'en',
      ),
    ).toBe('Read as “2 mərtəbə”, not understood');
  });

  it('words the operator’s figure the same way it words a reading', () => {
    // An override is what the case is decided on, so the table, the ruled-out
    // reason and the report all print it — and they print it through this one
    // function, so they cannot word one figure two ways (COMM-193).
    expect(
      parameterPhrase(
        t,
        parameter('landRight', {
          value: 'Ownership',
          source: 'StatedByOperator',
          stated: 'Ownership',
          overriddenBy: { accountId: 'acc-1', at: '2026-09-28T10:00:00.000Z' },
          read: {
            value: 'LeaseOrUse',
            source: 'TitleDocumentType',
            stated: null,
            from: null,
            calculation: null,
          },
        }),
        'en',
      ),
    ).toBe('Ownership');
  });
});

describe('what the engine read, under a figure the operator stated', () => {
  const override = (read: CaseParameterDto['read']): CaseParameterDto =>
    parameter('height', {
      value: 14,
      source: 'StatedByOperator',
      stated: '14',
      overriddenBy: { accountId: 'acc-1', at: '2026-09-28T10:00:00.000Z' },
      read,
    });

  it('is nothing at all where no operator has stated the figure', () => {
    expect(asRead(parameter('height', { value: 12 }))).toBeNull();
  });

  it('words the displaced reading as the figure it was', () => {
    const read = asRead(
      override({
        value: 12,
        source: 'ReadOffDocument',
        stated: '12',
        from: null,
        calculation: null,
      }),
    );

    expect(read).not.toBeNull();
    expect(parameterPhrase(t, read as CaseParameterDto, 'en')).toBe('12');
    expect((read as CaseParameterDto).source).toBe('ReadOffDocument');
  });

  it('says a figure no paper stated was never established, rather than inventing one', () => {
    // The cell this whole feature exists for: a parameter with no reading at all
    // cannot be set by correcting a field, and the line under the operator's
    // figure must not imply a previous one (COMM-193).
    const read = asRead(
      override({
        value: null,
        source: null,
        stated: null,
        from: null,
        calculation: null,
      }),
    );

    expect(parameterPhrase(t, read as CaseParameterDto, 'en')).toBe(
      'Not established',
    );
  });

  it('keeps a refused reading refused under the operator’s figure', () => {
    const read = asRead(
      override({
        value: null,
        source: 'ReadOffDocument',
        stated: '2 mərtəbə',
        from: null,
        calculation: null,
      }),
    );

    expect(parameterPhrase(t, read as CaseParameterDto, 'en')).toBe(
      'Read as “2 mərtəbə”, not understood',
    );
  });
});

describe('why a provision was ruled out', () => {
  it('names the figure, what the rule asked and what the package has', () => {
    expect(
      conditionReasons(
        t,
        rule([{ parameter: 'landRight', holds: false, expected: OWNERSHIP }]),
        [parameter('landRight', { value: 'LeaseOrUse' })],
        'en',
      ),
    ).toEqual([
      'Right to the land: Ownership required, package has Lease or use',
    ]);
  });

  // The defect this exists for: on case e9155a81 the disposal order is a
  // lease-or-use title by its kind (ADR-0030), and the fold said only that
  // 8.0.9.1.2 wants land "owned and designated for housing".
  it('says it in Azerbaijani the way the panel prints it', () => {
    expect(
      conditionReasons(
        translator('az'),
        rule([{ parameter: 'landRight', holds: false, expected: OWNERSHIP }]),
        [parameter('landRight', { value: 'LeaseOrUse' })],
        'az',
      ),
    ).toEqual([
      'Torpaq sahəsi üzərində hüquq: Mülkiyyət tələb olunur, paketdə — İcarə və ya istifadə',
    ]);
  });

  it('lists every condition that failed, not the first', () => {
    expect(
      conditionReasons(
        t,
        rule([
          { parameter: 'landRight', holds: false, expected: OWNERSHIP },
          { parameter: 'height', holds: false, expected: UP_TO_12 },
        ]),
        [
          parameter('landRight', { value: 'LeaseOrUse' }),
          parameter('height', { value: 14 }),
        ],
        'en',
      ),
    ).toHaveLength(2);
  });

  // A rule is not ruled out by a figure nobody could read: saying so would
  // send the inspector to correct a reading that does not exist.
  it('reports neither a condition that holds nor one still undecided', () => {
    const conditions = rule([
      { parameter: 'height', holds: true, expected: UP_TO_12 },
      { parameter: 'builtYear', holds: null, expected: BEFORE_2013 },
      { parameter: 'landRight', holds: false, expected: OWNERSHIP },
    ]);
    const parameters = [
      parameter('height', { value: 9 }),
      parameter('builtYear', { value: null }),
      parameter('landRight', { value: 'LeaseOrUse' }),
    ];

    expect(conditionReasons(t, conditions, parameters, 'en')).toEqual([
      'Right to the land: Ownership required, package has Lease or use',
    ]);
    expect(undecidedNames(t, conditions)).toEqual(['Year built']);
  });
});
