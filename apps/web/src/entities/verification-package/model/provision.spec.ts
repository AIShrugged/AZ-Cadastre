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
  it('names the provision the case falls under, and what it is', () => {
    expect(provisionSummary(t, aProvision())).toBe(
      'provision.determined(provision=8.0.9.1.1,rule=pre-2013, lease)',
    );
  });

  // Guards the summary that read "Could be 8.0.9.1.1, 8.0.9.1.2, 8.0.9.2 …":
  // codes nobody has open at the desk. An undecided case says which figures
  // would settle it, and never lists the candidate codes.
  it('says which figures an undecided case is missing, not its codes', () => {
    const summary = provisionSummary(
      t,
      aProvision({
        outcome: 'Ambiguous',
        provision: null,
        candidates: ['8.0.10.2', '8.0.10.1'],
        undecidedOn: ['height', 'builtYear'],
      }),
    );

    expect(summary).toBe(
      'provision.ambiguous(params=provision.param.height, provision.param.builtYear)',
    );
    expect(summary).not.toContain('8.0.10');
  });

  it('shortens a long list of missing figures', () => {
    expect(
      provisionSummary(
        t,
        aProvision({
          outcome: 'Ambiguous',
          provision: null,
          candidates: ['8.0.10.2', '8.0.10.1'],
          undecidedOn: ['builtYear', 'storeys', 'height', 'span'],
        }),
      ),
    ).toBe(
      'provision.ambiguous(params=provision.param.builtYear, provision.param.storeys provision.and_more(n=2))',
    );
  });

  it('still says the case is open when no figure is named', () => {
    expect(
      provisionSummary(
        t,
        aProvision({ outcome: 'Ambiguous', provision: null, candidates: [] }),
      ),
    ).toBe('provision.ambiguous_open');
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
