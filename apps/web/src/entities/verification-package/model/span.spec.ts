import { describe, expect, it } from 'vitest';

import type {
  CaseProvisionDto,
  SpanCalculationDto,
} from '@cadastre/api-contracts/verification';

import {
  chainLine,
  spanParameter,
  spanPhrase,
  spanWithinLimit,
  unitLine,
} from './span';

const t = (key: string, params?: Record<string, string | number>) =>
  params === undefined
    ? key
    : `${key}(${Object.entries(params)
        .map(([name, value]) => `${name}=${value}`)
        .join(',')})`;

// The sample design the acceptance contract works its rule on.
const SAMPLE: SpanCalculationDto = {
  longest: 5.2,
  chains: [
    {
      chain: 'Numbered',
      spans: [
        { from: '1', to: '2', length: 4 },
        { from: '2', to: '3', length: 4.4 },
      ],
      longest: { from: '2', to: '3', length: 4.4 },
    },
    {
      chain: 'Lettered',
      spans: [
        { from: 'A', to: 'B', length: 2.4 },
        { from: 'B', to: 'C', length: 5.2 },
      ],
      longest: { from: 'B', to: 'C', length: 5.2 },
    },
  ],
  unit: 'mm',
  unitBasis: 'BuiltUpArea',
  setAside: ['A—C 7600'],
};

function aProvision(over: Partial<CaseProvisionDto> = {}): CaseProvisionDto {
  return {
    key: 'article_8_provisions',
    outcome: 'Ambiguous',
    provision: null,
    candidates: [],
    undecidedOn: [],
    parameters: [
      {
        parameter: 'span',
        value: 5.2,
        source: 'ReadOffDocument',
        stated: '1—2 4000',
        from: null,
        calculation: SAMPLE,
      },
    ],
    rules: [
      {
        provision: '8.0.9.2',
        description: '',
        conditions: [{ parameter: 'height', holds: true }],
        excluded: false,
        holds: false,
      },
      {
        provision: '8.0.10.2',
        description: '',
        conditions: [
          { parameter: 'builtYear', holds: null },
          { parameter: 'span', holds: true },
        ],
        excluded: false,
        holds: false,
      },
    ],
    provisions: [],
    titleDocuments: [],
    ...over,
  };
}

describe('the span, as the server calculated it', () => {
  it('names the axes the longest span lies between', () => {
    expect(spanPhrase(t, SAMPLE, 'en-GB')).toBe('span.value(m=5.2,axes=B—C)');
  });

  it('writes the lengths in the reader’s decimal separator, each span unbroken', () => {
    expect(chainLine(SAMPLE.chains[1]!, 'ru-RU')).toBe(
      'A\u2060—\u2060B\u00a02,4 · B\u2060—\u2060C\u00a05,2',
    );
  });

  it('says what the figures were read in and why', () => {
    expect(unitLine(t, SAMPLE)).toBe(
      'span.unit.BuiltUpArea(unit=span.unit_name.mm)',
    );
  });

  it('reads the limit off the row that holds the span to one', () => {
    expect(spanWithinLimit(aProvision())).toBe(true);
  });

  it('knows no limit where no row could hold the span', () => {
    expect(
      spanWithinLimit(
        aProvision({
          rules: [
            {
              provision: '8.0.10.2',
              description: '',
              conditions: [{ parameter: 'span', holds: null }],
              excluded: false,
              holds: false,
            },
          ],
        }),
      ),
    ).toBeNull();
    expect(spanWithinLimit(null)).toBeNull();
  });

  it('finds the span among the figures of the case', () => {
    expect(spanParameter(aProvision())?.calculation).toBe(SAMPLE);
    expect(spanParameter(aProvision({ parameters: [] }))).toBeNull();
  });
});
