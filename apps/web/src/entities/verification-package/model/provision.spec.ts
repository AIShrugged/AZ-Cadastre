import { describe, expect, it } from 'vitest';

import type { CaseProvisionDto } from '@cadastre/api-contracts/verification';

import { provisionSummary, unansweredAlternatives } from './provision';

const t = (key: string, params?: Record<string, string | number>) =>
  params === undefined
    ? key
    : `${key}(${Object.entries(params)
        .map(([name, value]) => `${name}=${value}`)
        .join(',')})`;

function aProvision(over: Partial<CaseProvisionDto> = {}): CaseProvisionDto {
  return {
    key: 'article_8_provisions',
    outcome: 'Determined',
    provision: '8.0.9.1.1',
    candidates: [],
    undecidedOn: [],
    parameters: [],
    rules: [],
    provisions: [
      {
        provision: '8.0.9.1.1',
        description: 'pre-2013, lease',
        titleRight: 'LeaseOrUse',
        requirements: [
          {
            anyOf: ['approved_design', 'operation_acceptance_act'],
            onlyBuiltBefore: null,
            applies: true,
            answered: false,
          },
        ],
      },
    ],
    titleDocuments: [],
    ...over,
  };
}

describe('provisionSummary', () => {
  it('names the provision the case falls under', () => {
    expect(provisionSummary(t, aProvision())).toBe(
      'provision.determined(provision=8.0.9.1.1)',
    );
  });

  // Not a blank: a case whose height nobody read could still be one of two
  // provisions, and the reader is told which two.
  it('names every candidate of a case it could not decide', () => {
    expect(
      provisionSummary(
        t,
        aProvision({
          outcome: 'Ambiguous',
          provision: null,
          candidates: ['8.0.10.2', '8.0.10.1'],
        }),
      ),
    ).toBe('provision.ambiguous(list=8.0.10.2, 8.0.10.1)');
  });

  it('says so of a case no provision covers', () => {
    expect(
      provisionSummary(
        t,
        aProvision({ outcome: 'Undetermined', provision: null }),
      ),
    ).toBe('provision.undetermined');
  });
});

describe('unansweredAlternatives', () => {
  it('reads the papers a still-open group of the decided provision would take', () => {
    expect(unansweredAlternatives(aProvision())).toEqual([
      'approved_design',
      'operation_acceptance_act',
    ]);
  });

  it('reads nothing once the group is answered', () => {
    const answered = aProvision();
    const [standing] = answered.provisions;

    expect(
      unansweredAlternatives({
        ...answered,
        provisions: [
          {
            ...standing!,
            requirements: standing!.requirements.map(requirement => ({
              ...requirement,
              answered: true,
            })),
          },
        ],
      }),
    ).toEqual([]);
  });

  // Which papers are owed is exactly what is unknown while no provision is
  // decided, so no alternatives are read off a candidate.
  it('reads nothing while the provision is undecided', () => {
    expect(
      unansweredAlternatives(
        aProvision({ outcome: 'Ambiguous', provision: null }),
      ),
    ).toEqual([]);
    expect(unansweredAlternatives(null)).toEqual([]);
  });
});
