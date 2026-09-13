import { describe, expect, it } from 'vitest';

import { TitleDocumentRightConflictException } from '../exceptions/index.js';

import { ARTICLE_8_PROVISIONS } from './article-8-provisions.table.js';
import { DocumentType } from './document-type.vo.js';
import {
  ProvisionsSpec,
  Requirement,
  TitleDocumentEntry,
  type CaseParameters,
  type ProvisionDecision,
} from './provision.vo.js';

/*
 * The decision table of the customer's acceptance contract, held to the
 * contract's own cases (ADR-0025).
 *
 * `FIXTURES` in the reference implementation lists twenty-three cases, each with
 * the provision it must be decided under. Every one of them that turns on the
 * six figures is here with the provision the contract expects; the ones that
 * differ only in which papers were supplied decide the same provision as their
 * neighbours and are covered where the requirements are (case-provision).
 * An implementation that disagreed with any of these would be a different
 * policy, not a refactoring of this one.
 */

const TABLE = ProvisionsSpec.of(ARTICLE_8_PROVISIONS);

// The contract's BASE: a two-storey house of 7.4 m with 4.2 m spans, built in
// 2014 on land owned and designated for housing.
const BASE: CaseParameters = {
  builtYear: 2014,
  storeys: 2,
  height: 7.4,
  span: 4.2,
  landRight: 'Ownership',
  purpose: 'Residential',
};

function decide(overrides: Partial<CaseParameters>): ProvisionDecision {
  return TABLE.decide({ ...BASE, ...overrides });
}

function provisionOf(decision: ProvisionDecision): string | null {
  return decision.outcome === 'Determined'
    ? decision.provision.provision
    : null;
}

describe('ProvisionsSpec — the Article 8 decision table', () => {
  describe('the acceptance contract’s cases', () => {
    const CASES: readonly {
      readonly name: string;
      readonly overrides: Partial<CaseParameters>;
      readonly provision: string | null;
    }[] = [
      {
        name: 'TC-01 post-2013, notification procedure',
        overrides: {},
        provision: '8.0.10.2',
      },
      {
        name: 'TC-03 post-2013, height not established',
        overrides: { height: null },
        provision: null,
      },
      {
        name: 'TC-04 post-2013, four storeys → permit required',
        overrides: { storeys: 4 },
        provision: '8.0.10.1',
      },
      {
        name: 'TC-05 post-2013, 15 m → permit required',
        overrides: { height: 15 },
        provision: '8.0.10.1',
      },
      {
        name: 'TC-06 post-2013, 8 m span → permit required',
        overrides: { span: 8 },
        provision: '8.0.10.1',
      },
      {
        name: 'TC-08 pre-2013, lease',
        overrides: { builtYear: 2010, height: 8, landRight: 'LeaseOrUse' },
        provision: '8.0.9.1.1',
      },
      {
        name: 'TC-12 pre-2013, ownership, residential',
        overrides: { builtYear: 2010, height: 8 },
        provision: '8.0.9.1.2',
      },
      {
        name: 'TC-13 pre-2013, ownership, non-residential → no provision',
        overrides: { builtYear: 2010, height: 8, purpose: 'Other' },
        provision: null,
      },
      {
        name: 'TC-14 pre-2013, taller than 12 m',
        overrides: { builtYear: 2010, height: 15 },
        provision: '8.0.9.2',
      },
      {
        name: 'TC-15 boundary: built in 2012 → pre-Code regime',
        overrides: { builtYear: 2012, height: 8 },
        provision: '8.0.9.1.2',
      },
      {
        name: 'TC-16 boundary: built in 2013 → post-Code regime',
        overrides: { builtYear: 2013 },
        provision: '8.0.10.2',
      },
      {
        name: 'TC-17 date of construction not established',
        overrides: { builtYear: null },
        provision: null,
      },
      {
        name: 'TC-18 built after 06.2025, notification procedure',
        overrides: { builtYear: 2025 },
        provision: '8.0.10.2',
      },
    ];

    for (const { name, overrides, provision } of CASES) {
      it(name, () => {
        expect(provisionOf(decide(overrides))).toBe(provision);
      });
    }
  });

  describe('a figure nobody could state', () => {
    /*
     * The one thing the table must never do is guess which side of a line an
     * unread figure falls on. An unread height leaves the notification
     * procedure open and the permit procedure holding, so both are candidates
     * and neither is applied.
     */
    it('leaves every provision it could have made the first one open', () => {
      const decision = decide({ height: null });

      expect(decision.outcome).toBe('Ambiguous');
      if (decision.outcome !== 'Ambiguous') return;
      expect(decision.candidates.map(rule => rule.provision)).toEqual([
        '8.0.10.2',
        '8.0.10.1',
      ]);
      expect(decision.undecidedOn).toEqual(['height']);
    });

    it('names every figure whose reading would settle it', () => {
      const decision = decide({ builtYear: null });

      expect(decision.outcome).toBe('Ambiguous');
      if (decision.outcome !== 'Ambiguous') return;
      expect(decision.candidates.map(rule => rule.provision)).toEqual([
        '8.0.9.1.2',
        '8.0.10.2',
        '8.0.10.1',
      ]);
      expect(decision.undecidedOn).toEqual(['builtYear']);
    });

    // A figure a provision does not turn on decides nothing about it: 8.0.10.1
    // takes anything built from 2013, however tall.
    it('does not hold an unread figure against a provision that does not turn on it', () => {
      const decision = decide({ storeys: null, height: null, span: null });

      expect(decision.outcome).toBe('Ambiguous');
      if (decision.outcome !== 'Ambiguous') return;
      expect(decision.candidates.at(-1)?.provision).toBe('8.0.10.1');
    });
  });

  describe('its lines', () => {
    it('reads "at most 12 m" inclusive, as the contract writes it', () => {
      expect(provisionOf(decide({ height: 12 }))).toBe('8.0.10.2');
      expect(provisionOf(decide({ builtYear: 2010, height: 12 }))).toBe(
        '8.0.9.1.2',
      );
    });

    it('reads "taller than 12 m" exclusive, the other side of the same line', () => {
      expect(provisionOf(decide({ builtYear: 2010, height: 12.01 }))).toBe(
        '8.0.9.2',
      );
    });

    it('reads three storeys and 6 m spans inclusive', () => {
      expect(provisionOf(decide({ storeys: 3, span: 6 }))).toBe('8.0.10.2');
    });

    it('says nothing about a building no row covers', () => {
      const decision = decide({ builtYear: 2010, height: 8, purpose: 'Other' });

      expect(decision.outcome).toBe('Undetermined');
    });
  });

  describe('what each provision asks for', () => {
    it('asks nothing beyond the title of a pre-2013 owned house', () => {
      expect(TABLE.ruleFor('8.0.9.1.2')?.requirements).toEqual([]);
    });

    it('takes an approved design or an acceptance act, either one, for a pre-2013 leased house', () => {
      const [group] = TABLE.ruleFor('8.0.9.1.1')!.requirements;

      expect(group?.anyOf.map(type => type.value)).toEqual([
        'approved_design',
        'operation_acceptance_act',
      ]);
      expect(
        group?.answeredBy([DocumentType.create('operation_acceptance_act')]),
      ).toBe(true);
    });

    it('names the class of title the two pre-2013 low-rise provisions rest on', () => {
      expect(TABLE.ruleFor('8.0.9.1.1')?.titleRight).toBe('LeaseOrUse');
      expect(TABLE.ruleFor('8.0.9.1.2')?.titleRight).toBe('Ownership');
      expect(TABLE.ruleFor('8.0.10.2')?.titleRight).toBeNull();
    });
  });

  describe('a requirement the policy meets through an integration from a year on', () => {
    const notice = Requirement.of({
      anyOf: ['construction_completion_notice'],
      onlyBuiltBefore: 2026,
    });

    it('asks for the paper up to that year', () => {
      expect(notice.appliesTo(2025)).toBe(true);
    });

    it('does not ask for it from that year on', () => {
      expect(notice.appliesTo(2026)).toBe(false);
    });

    it('does not guess for a year nobody stated', () => {
      expect(notice.appliesTo(null)).toBeNull();
    });
  });

  describe('the title documents and their windows', () => {
    const decision27 = TitleDocumentEntry.of({
      item: '2.7',
      type: 'homestead_land_allocation_decision',
      landRight: 'LeaseOrUse',
      dateField: 'issue_date',
      issuedFrom: null,
      issuedBefore: '2001-01-01',
    });

    // TC-08 and TC-09 of the contract.
    it('admits a decision of 1995 under item 2.7', () => {
      expect(
        decision27.admits({ first: '1995-05-12', last: '1995-05-12' }),
      ).toBe(true);
    });

    it('refuses one of 2003', () => {
      expect(
        decision27.admits({ first: '2003-04-10', last: '2003-04-10' }),
      ).toBe(false);
    });

    it('refuses one dated the day the window closes', () => {
      expect(
        decision27.admits({ first: '2001-01-01', last: '2001-01-01' }),
      ).toBe(false);
    });

    it('cannot say for a year alone that straddles the edge', () => {
      const decision22 = TABLE.entriesFor(
        DocumentType.create('land_allocation_decision'),
      ).find(entry => entry.item === '2.2')!;

      expect(
        decision22.admits({ first: '1995-01-01', last: '1995-12-31' }),
      ).toBeNull();
    });

    it('cannot say for a date nobody read', () => {
      expect(decision27.admits(null)).toBeNull();
    });

    it('decides the right a title confers by its kind', () => {
      expect(
        TABLE.rightConferredBy(DocumentType.create('land_right_state_act')),
      ).toBe('Ownership');
      expect(
        TABLE.rightConferredBy(DocumentType.create('household_book_extract')),
      ).toBe('LeaseOrUse');
      expect(
        TABLE.rightConferredBy(DocumentType.create('sketch_project')),
      ).toBeNull();
    });

    it('lists each type once however many items name it', () => {
      const keys = TABLE.titleTypes.map(type => type.value);

      expect(new Set(keys).size).toBe(keys.length);
      expect(keys).toContain('land_allocation_decision');
    });

    it('refuses a type listed as conferring two rights', () => {
      expect(() =>
        ProvisionsSpec.of({
          ...ARTICLE_8_PROVISIONS,
          titleDocuments: [
            {
              item: 'a',
              type: 'land_right_state_act',
              landRight: 'Ownership',
              dateField: 'issue_date',
              issuedFrom: null,
              issuedBefore: null,
            },
            {
              item: 'b',
              type: 'land_right_state_act',
              landRight: 'LeaseOrUse',
              dateField: 'issue_date',
              issuedFrom: null,
              issuedBefore: null,
            },
          ],
        }),
      ).toThrow(TitleDocumentRightConflictException);
    });
  });
});
